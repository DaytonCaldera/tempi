import NextAuth from "next-auth"
import type { JWT } from "next-auth/jwt"
import Google from "next-auth/providers/google"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import clientPromise from "@/lib/mongodb"
import { getDb } from "@/lib/api"
import { getRolePermissions } from "@/lib/roles"
import { getSuperAdminEmail, isPlaceholderOrg, PLACEHOLDER_CLIENT_ID, ROLES } from "@/lib/constants"
import type { Membership, SessionMembership, User } from "@/types/models"

const SUPERADMIN_EMAIL = getSuperAdminEmail();

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
		async jwt({ token, user, trigger, session }) {
			// 1. Sign-in: resolve the active organization, role and permissions from the DB
			if (user) {
				const userDoc = await findUser(user.email);
				let memberships = realMemberships(userDoc);

				// Users from before the multi-organization model only have a top-level clientId:
				// turn it into their first membership (only happens once)
				if (memberships.length === 0 && user.clientId && user.clientId.toString() !== PLACEHOLDER_CLIENT_ID) {
					memberships = [{ clientId: user.clientId, role: user.role || ROLES.NEW_USER, status: "active", joinedAt: new Date() } as unknown as Membership];
					const db = await getDb();
					await db.collection('users').updateOne(
						{ email: user.email },
						{ $set: { organizations: memberships, activeOrganization: user.clientId } }
					);
				}

				if (user.email === SUPERADMIN_EMAIL) {
					// Superadmin sees every organization; clientId is only the one picked in the switcher
					token.role = ROLES.SUPERADMIN;
					token.clientId = user.activeOrganization?.toString() || null;
				} else {
					// activeOrganization is kept up to date by create/join/switch. A stale value (like the old
					// placeholder) won't match any membership and falls back to the first active one.
					const activeId = userDoc?.activeOrganization?.toString() || memberships[0]?.clientId?.toString();
					const membership =
						memberships.find(m => m.clientId.toString() === activeId && m.status === 'active') ||
						memberships.find(m => m.status === 'active');

					token.role = membership?.role || ROLES.NEW_USER;
					token.clientId = membership?.clientId.toString() || null; // Always a string, ObjectIds break the JWT
					token.organizations = toSessionMemberships(memberships);
				}

				token.activeOrganization = token.clientId;
				token.permissions = await getRolePermissions(token.role);
			}

			// 2. useSession().update({...}) from the client, e.g. after switching organization
			if (trigger === "update" && session) {
				if (session.role) token.role = session.role;

				if (session.clientId) {
					if (token.role === ROLES.SUPERADMIN) {
						token.clientId = session.clientId === 'all' ? null : session.clientId;
					} else {
						// Keep the current context if the user doesn't belong to the requested organization
						const context = await loadOrganizationContext(token, session.clientId);
						if (context) Object.assign(token, context);
					}
				}
				if (session.clientCode) token.clientCode = session.clientCode;
				if (session.isActive !== undefined) token.isActive = session.isActive;
				if (session.organizations) token.organizations = session.organizations;
			}

			// 3. Pending users wait for an admin's approval, which only changes the DB.
			// Re-read their membership so they leave the "pending" screen without signing in again.
			if (!user && token.role === ROLES.PENDING_USER && token.clientId) {
				const context = await loadOrganizationContext(token, token.clientId);
				if (context && context.role !== token.role) Object.assign(token, context);
			}

			return token;
		},
		async session({ session, token }) {
			if (session.user) {
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

async function findUser(email: string | null | undefined) {
	const db = await getDb();
	return db.collection<User>('users').findOne({ email: email ?? undefined });
}

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

/**
 * Resolves role, permissions and memberships for one of the user's organizations.
 * Used to switch organization without signing out, and to refresh pending users.
 * @returns the token fields to update, or null if the user doesn't belong to that organization.
 */
async function loadOrganizationContext(token: JWT, clientId: string) {
	const memberships = realMemberships(await findUser(token.email));
	const membership = memberships.find(m => m.clientId.toString() === clientId);
	if (!membership) return null;

	return {
		clientId: membership.clientId.toString(),
		activeOrganization: membership.clientId.toString(),
		role: membership.role,
		permissions: await getRolePermissions(membership.role),
		organizations: toSessionMemberships(memberships),
	};
}
