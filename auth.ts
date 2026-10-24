import NextAuth from "next-auth"
import type { JWT } from "next-auth/jwt"
import type { Provider } from "next-auth/providers"
import Google from "next-auth/providers/google"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import Resend from "next-auth/providers/resend"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import clientPromise from "@/lib/mongodb"
import { getDb } from "@/lib/api"
import { getRolePermissions } from "@/lib/roles"
import { recordDailyActivity } from "@/lib/activity"
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit"
import { findUserByEmail, forgetCachedUsers } from "@/lib/users"
import { isTimeZone } from "@/lib/timezone"
import { getSuperAdminEmail, isPlaceholderOrg, PLACEHOLDER_CLIENT_ID, ROLES } from "@/lib/constants"
import { nameFromEmail, NEW_USER_DEFAULTS, SIGN_IN_METHODS } from "@/lib/auth-methods"
import { MAGIC_LINK_MAX_AGE_SECONDS, sendMagicLink } from "@/lib/magic-link"
import type { Membership, SessionMembership, User } from "@/types/models"

const SUPERADMIN_EMAIL = getSuperAdminEmail();
if (!SUPERADMIN_EMAIL) console.warn("SUPERADMIN_EMAIL is not set: no user will have superadmin access.");

/**
 * Users are matched by email across methods: the same address signs in to the same account with Google or an
 * email link. Microsoft doesn't link (see below), so its users keep using the method they signed up with.
 */
const providers: Provider[] = [
	Google({
		clientId: process.env.GOOGLE_ID_CLIENT as string,
		clientSecret: process.env.GOOGLE_API_SECRET as string,
		// Users can exist before their first Google sign-in (e.g. created in the DB, signed up with an email link,
		// or by sign-ins written to another database before MONGODB_DB): link them by email instead of failing
		// with OAuthAccountNotLinked. Safe with Google only because it verifies the email it returns.
		allowDangerousEmailAccountLinking: true,
		// Always show the account chooser, otherwise Google silently reuses the last account
		authorization: { params: { prompt: "select_account" } },
	}),
];

if (SIGN_IN_METHODS.email) {
	providers.push(Resend({
		apiKey: process.env.AUTH_RESEND_KEY,
		from: process.env.EMAIL_FROM,
		maxAge: MAGIC_LINK_MAX_AGE_SECONDS,
		sendVerificationRequest: sendMagicLink,
	}));
}

if (SIGN_IN_METHODS.microsoft) {
	providers.push(MicrosoftEntraID({
		clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
		clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
		// A tenant URL limits sign-in to that organization; without it, any work or personal Microsoft account
		issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
		// No allowDangerousEmailAccountLinking: in multi-tenant apps Entra doesn't guarantee the email claim
		// is verified, so linking by it would let anyone who controls a tenant take over an existing account.
		profile(profile) {
			return {
				id: profile.sub,
				name: profile.name,
				// Users are looked up by exact email, and Entra keeps the case the admin typed
				email: profile.email?.toLowerCase(),
				// The default fetches the photo from Graph as a data URL, which would bloat the session cookie
				image: null,
			}
		},
	}));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
	// Same database as getDb(), so sign-in writes users and accounts where the app reads them
	adapter: MongoDBAdapter(clientPromise, { databaseName: process.env.MONGODB_DB }),
	providers,
	pages: {
		signIn: "/login",
		verifyRequest: "/login/check-email",
		error: "/login", // Gets ?error=..., shown by the login page
	},
	callbacks: {
		// Every user is looked up by email (findUserByEmail): an account without one could never be resolved
		signIn: ({ user }) => !!user.email,
		/**
		 * Runs on sign-in and every time the session is read (pages, API routes, the proxy).
		 * Role, organization, permissions and status are always resolved from the DB, never taken from the client,
		 * so role changes and deactivations apply within seconds (see findUserByEmail) instead of when the JWT expires.
		 */
		async jwt({ token, user, trigger, session }) {
			let requestedClientId = token.clientId ?? null;

			if (user) {
				const userDoc = await findUserByEmail(user.email, { fresh: true });

				// Users from before the multi-organization model only have a top-level clientId:
				// turn it into their first membership (only happens once)
				if (realMemberships(userDoc).length === 0 && user.clientId && user.clientId.toString() !== PLACEHOLDER_CLIENT_ID) {
					const memberships = [{ clientId: user.clientId, role: user.role || ROLES.NEW_USER, status: "active", joinedAt: new Date() }];
					const db = await getDb();
					await db.collection('users').updateOne(
						{ email: user.email },
						{ $set: { organizations: memberships, activeOrganization: user.clientId } }
					);
					forgetCachedUsers();
				}
				requestedClientId = null; // Start in the organization saved in activeOrganization
			}

			// useSession().update({ clientId }) from the client, e.g. after switching organization.
			// Only the organization is read from the client: whether the user may use it is checked below.
			if (trigger === "update" && typeof session?.clientId === "string") {
				requestedClientId = session.clientId;
			}

			// Sign-in and session updates (e.g. after joining or switching organization) must not see a cached user
			const fresh = !!user || trigger === "update";
			// Taken before the read, so this process's own cached copy of it still counts as fresh enough
			const startedAt = Date.now();
			Object.assign(token, await resolveContext(token, requestedClientId, fresh));
			if (fresh) token.resolvedAt = startedAt;
			// The time zone set in the account. Read from the users cache resolveContext just filled
			const timeZone = (await findUserByEmail(token.email, { notBefore: token.resolvedAt }))?.timeZone;
			token.timeZone = isTimeZone(timeZone) ? timeZone : null;
			await recordLastSeen(token);
			return token;
		},
		async session({ session, token }) {
			if (session.user) {
				if (token.sub) session.user.id = token.sub; // The user's _id (set by the adapter on sign-in)
				session.user.role = token.role as string;
				session.user.clientId = token.clientId ?? undefined;
				session.user.clientCode = token.clientCode;
				session.user.isActive = token.isActive;
				session.user.permissions = token.permissions;
				session.user.organizations = token.organizations;
				session.user.activeOrganization = token.clientId ?? undefined;
				session.user.startPage = token.startPage ?? null;
				session.user.timeZone = token.timeZone ?? null;
			}
			return session;
		},
		authorized: async ({ auth }) => !!auth,
	},
	events: {
		// Runs right after the adapter inserts the user, before the jwt callback reads it. Gives every method the
		// same starting fields, and stores when the user was created (the superadmin panel counts sign-ups by it).
		async createUser({ user }) {
			const name = user.name || nameFromEmail(user.email!);
			const db = await getDb();
			// Auth.js also fires this when it links a new Google account to an existing user by email
			// (allowDangerousEmailAccountLinking): only a document the adapter just inserted lacks a role,
			// so existing users keep their organizations
			const { modifiedCount } = await db.collection('users').updateOne(
				{ email: user.email, role: { $exists: false } },
				{ $set: { ...NEW_USER_DEFAULTS, name, createdAt: new Date() } }
			);
			if (modifiedCount) await logAudit(AUDIT_ACTIONS.SIGN_UP, { actor: { id: user.id, email: user.email, name } });
		},
		async signIn({ user, account }) {
			const db = await getDb();
			await db.collection('users').updateOne({ email: user.email }, { $set: { lastLoginAt: new Date() } });
			await logAudit(AUDIT_ACTIONS.SIGN_IN, {
				actor: { id: user.id, email: user.email, name: user.name },
				details: { provider: account?.provider },
			});
		},
	},
	session: { strategy: 'jwt' },
});

/** How often a signed-in user's lastSeenAt is written. The session is read on every request, so not on each one. */
const LAST_SEEN_INTERVAL_MS = 5 * 60_000;

/**
 * Saves when the user was last seen (users.lastSeenAt) and that they were active today (lib/activity.ts),
 * at most once per LAST_SEEN_INTERVAL_MS per session. The superadmin panel counts active users with them.
 * A failed write only loses one data point.
 */
async function recordLastSeen(token: JWT) {
	const now = Date.now();
	if (!token.email || token.isActive === false || now - (token.lastSeenAt ?? 0) < LAST_SEEN_INTERVAL_MS) return;
	token.lastSeenAt = now;
	try {
		const db = await getDb();
		await Promise.all([
			db.collection('users').updateOne({ email: token.email }, { $set: { lastSeenAt: new Date(now) } }),
			recordDailyActivity(token.email, token.sub, new Date(now)),
		]);
	} catch (error) {
		console.error("lastSeenAt write failed:", error);
	}
}

/** The user's memberships, without the old "sup22" placeholder (it would win over the real organization). */
function realMemberships(userDoc: User | null): Membership[] {
	return (userDoc?.organizations || []).filter(m => !isPlaceholderOrg(m));
}

function toSessionMemberships(memberships: Membership[]): SessionMembership[] {
	return memberships.map(m => ({
		...m,
		role: m.role === ROLES.SUPERADMIN ? ROLES.USER : m.role, // Same rule as resolveContext
		clientId: m.clientId.toString(),
		departments: m.departments?.map(id => id.toString()),
	}));
}

/** Permissions of the role, reusing the token's when the role didn't change (saves a query per request). */
async function permissionsFor(token: JWT, role: string) {
	return token.role === role && token.permissions ? token.permissions : getRolePermissions(role);
}

/**
 * Resolves the token fields from the user's document.
 * @param requestedClientId organization the user wants to work in. Used only when the user has an active
 * membership there. Otherwise falls back to the saved activeOrganization, then to the first active membership.
 * The superadmin never gets an organization.
 * @param fresh read the user from the DB instead of the short-lived cache.
 */
async function resolveContext(token: JWT, requestedClientId: string | null, fresh: boolean) {
	// A copy cached by this process before the token's last fresh read (e.g. right before the user closed
	// or left an organization in another process) would bring back what that read already left out
	let userDoc = await findUserByEmail(token.email, { fresh, notBefore: token.resolvedAt });
	const isSuperAdmin = !!SUPERADMIN_EMAIL && userDoc?.email?.toLowerCase() === SUPERADMIN_EMAIL;

	// The cache is per server process: a cached copy may be from before the user joined or created the
	// requested organization (e.g. the reload right after the lobby), so re-read it instead of falling back
	const hasRequested = realMemberships(userDoc).some(m => m.status === 'active' && m.clientId.toString() === requestedClientId);
	if (!fresh && requestedClientId && !isSuperAdmin && !hasRequested) {
		userDoc = await findUserByEmail(token.email, { fresh: true });
	}

	const noAccess = { role: ROLES.NEW_USER, clientId: null, activeOrganization: null, permissions: {}, organizations: [], startPage: null };

	// Deleted or globally disabled account
	if (!userDoc || userDoc.isActive === false) return { ...noAccess, isActive: false };

	if (isSuperAdmin) {
		// The superadmin doesn't work inside organizations: it only uses the /superadmin panel (see proxy.ts)
		return { ...noAccess, role: ROLES.SUPERADMIN, isActive: true };
	}

	const memberships = realMemberships(userDoc);
	const active = memberships.filter(m => m.status === 'active');
	const savedId = userDoc.activeOrganization?.toString();
	const membership =
		active.find(m => m.clientId.toString() === requestedClientId) ||
		active.find(m => m.clientId.toString() === savedId) ||
		active[0];

	if (!membership) {
		// No organization yet goes to the lobby; deactivated in every organization goes to /unauthorized
		return { ...noAccess, organizations: toSessionMemberships(memberships), isActive: memberships.length === 0 };
	}

	// Superadmin comes only from SUPERADMIN_EMAIL: a membership saying "superadmin" (a script, a manual DB edit)
	// must not unlock it, so it gets the least privileged member role instead
	const role = membership.role === ROLES.SUPERADMIN ? ROLES.USER : membership.role;

	return {
		role,
		clientId: membership.clientId.toString(), // Always a string, ObjectIds break the JWT
		activeOrganization: membership.clientId.toString(),
		permissions: await permissionsFor(token, role),
		organizations: toSessionMemberships(memberships),
		startPage: userDoc.startPage ?? null,
		isActive: true,
	};
}
