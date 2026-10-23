import NextAuth from "next-auth"
import type { JWT } from "next-auth/jwt"
import Google from "next-auth/providers/google"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import clientPromise from "@/lib/mongodb"
import { getDb, toObjectId } from "@/lib/api"
import { getRolePermissions } from "@/lib/roles"
import { findUserByEmail, forgetCachedUsers } from "@/lib/users"
import { getSuperAdminEmail, isPlaceholderOrg, PLACEHOLDER_CLIENT_ID, ROLES } from "@/lib/constants"
import type { Membership, SessionMembership, User } from "@/types/models"

const SUPERADMIN_EMAIL = getSuperAdminEmail();
if (!SUPERADMIN_EMAIL) console.warn("SUPERADMIN_EMAIL is not set: no user will have superadmin access.");

export const { handlers, auth, signIn, signOut } = NextAuth({
	adapter: MongoDBAdapter(clientPromise),
	providers: [
		Google({
			clientId: process.env.GOOGLE_ID_CLIENT as string,
			clientSecret: process.env.GOOGLE_API_SECRET as string,
			profile(profile) {
				// Maps the Google profile to the user document created on first sign-in
				return {
					id: profile.sub,
					name: profile.name,
					email: profile.email,
					image: profile.picture,
					role: ROLES.NEW_USER,
					clientId: null, // New users get an organization when they create or join one in the lobby
					isActive: true,
					permissions: {},
					organizations: [],
					activeOrganization: null,
				}
			}
		})
	],
	callbacks: {
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
			return Object.assign(token, await resolveContext(token, requestedClientId, fresh));
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
			}
			return session;
		},
		authorized: async ({ auth }) => !!auth,
	},
	session: { strategy: 'jwt' },
});

/** The user's memberships, without the old "sup22" placeholder (it would win over the real organization). */
function realMemberships(userDoc: User | null): Membership[] {
	return (userDoc?.organizations || []).filter(m => !isPlaceholderOrg(m));
}

function toSessionMemberships(memberships: Membership[]): SessionMembership[] {
	return memberships.map(m => ({
		...m,
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
 * membership there (any organization for the superadmin; null means "all"). Otherwise falls back to the
 * saved activeOrganization, then to the first active membership.
 * @param fresh read the user from the DB instead of the short-lived cache.
 */
async function resolveContext(token: JWT, requestedClientId: string | null, fresh: boolean) {
	let userDoc = await findUserByEmail(token.email, { fresh });
	const isSuperAdmin = !!SUPERADMIN_EMAIL && userDoc?.email?.toLowerCase() === SUPERADMIN_EMAIL;

	// The cache is per server process: a cached copy may be from before the user joined or created the
	// requested organization (e.g. the reload right after the lobby), so re-read it instead of falling back
	const hasRequested = realMemberships(userDoc).some(m => m.status === 'active' && m.clientId.toString() === requestedClientId);
	if (!fresh && requestedClientId && !isSuperAdmin && !hasRequested) {
		userDoc = await findUserByEmail(token.email, { fresh: true });
	}

	const noAccess = { role: ROLES.NEW_USER, clientId: null, activeOrganization: null, permissions: {}, organizations: [] };

	// Deleted or globally disabled account
	if (!userDoc || userDoc.isActive === false) return { ...noAccess, isActive: false };

	if (isSuperAdmin) {
		// Superadmin sees every organization; clientId is only the one picked in the switcher
		const requested = requestedClientId ?? (token.role === ROLES.SUPERADMIN ? null : userDoc.activeOrganization?.toString());
		const clientId = requested && requested !== 'all' ? toObjectId(requested)?.toString() ?? null : null;
		return {
			role: ROLES.SUPERADMIN,
			clientId,
			activeOrganization: clientId,
			permissions: await permissionsFor(token, ROLES.SUPERADMIN),
			isActive: true,
		};
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

	return {
		role: membership.role,
		clientId: membership.clientId.toString(), // Always a string, ObjectIds break the JWT
		activeOrganization: membership.clientId.toString(),
		permissions: await permissionsFor(token, membership.role),
		organizations: toSessionMemberships(memberships),
		isActive: true,
	};
}
