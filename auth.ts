import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import clientPromise from "@/lib/mongodb"
import { getSuperAdminEmail, isPlaceholderOrg, PLACEHOLDER_CLIENT_ID, ROLES } from "./lib/constants"
import mongo from "@/lib/mongodb";
import { ObjectId } from "mongodb"


const SUPERADMIN_EMAIL = getSuperAdminEmail(); // Get the super admin email from env or default
const client = await mongo;
const db = client.db(process.env.MONGODB_DB);

export const { handlers, auth, signIn, signOut } = NextAuth({
	adapter: MongoDBAdapter(clientPromise),
	providers: [
		Google({
			clientId: process.env.GOOGLE_ID_CLIENT as string,
			clientSecret: process.env.GOOGLE_API_SECRET as string,
			profile(profile) {
				// This maps the Google profile to your database User document
				return {
					id: profile.sub,
					name: profile.name,
					email: profile.email,
					image: profile.picture,
					role: profile.role ?? "new_user", // Default role for new users
					clientId: profile.clientId ?? null, // New users get an organization when they create or join one in the lobby
					clientCode: profile.clientCode ?? null,
					isActive: profile.isActive ?? true, // Default to active for new users, they are gonna verify laternpm 
					permissions: profile.permissions || {}, // You can also store permissions directly in the user document if needed
					organizations: profile.organizations || [], // Array of orgs the user belongs to
					activeOrganization: profile.activeOrganization ?? null // The user's currently active organization
				}
			}
		})
	],
	callbacks: {
		async jwt({ token, user, trigger, session }) {
			if (user) {

				const userDoc = await db.collection('users').findOne({ email: user.email });
				// Ignore the old "sup22" placeholder entry, otherwise it wins over the user's real organization
				let organizations = (userDoc?.organizations || []).filter((org: any) => !isPlaceholderOrg(org));

				// 2. MIGRATION LOGIC: If no organizations exist, create the first one from old data
				if (organizations.length === 0 && user.clientId && user.clientId.toString() !== PLACEHOLDER_CLIENT_ID) {
					const initialOrg = {
						clientId: user.clientId,
						role: user.role || "new_user",
						status: "active",
						joinedAt: new Date()
					};
					organizations = [initialOrg];

					// Update DB so this only happens once
					await db.collection('users').updateOne(
						{ email: user.email },
						{ $set: { organizations: organizations, activeOrganization: user.clientId } }
					);
				}

				


				if (user.email === SUPERADMIN_EMAIL) {
					token.role = ROLES.SUPERADMIN;
					token.clientId = session?.activeOrganization?.toString() || user.activeOrganization?.toString() || null; // Superadmin can have a clientId for context switching, but it's optional
				} else {
					// FIX: Find the organization that matches the user's current "assigned" clientId
					// We use .toString() to ensure we are comparing strings to strings
					// Read activeOrganization from the DB doc, it's kept up to date by create/join/switch.
					// A stale placeholder value won't match any org and falls through to the first active one.
					const currentId = userDoc?.activeOrganization?.toString() || user.activeOrganization?.toString() || organizations[0]?.clientId?.toString(); // Fallback to first org if activeOrganization is not set
					const activeOrg = organizations.find((org: any) =>
						org.clientId?.toString() === currentId && org.status === 'active'
					);

					// Fallback: If the user has active orgs but currentId didn't match, pick the first active one
					const effectiveOrg = activeOrg || organizations.find((o: any) => o.status === 'active');

					token.role = effectiveOrg?.role || "new_user";
					// ALWAYS store as string in the token to avoid BSON Errors in the session
					token.clientId = effectiveOrg?.clientId?.toString() || null;
					const orgs = organizations.map((org: any) => ({
						...org,
						clientId: org.clientId?.toString() // Ensure all clientIds in organizations are strings
					}));
					token.organizations = orgs; // Store all orgs in the token for easy access in the app
				}

				token.activeOrganization = session?.activeOrganization?.toString() || user.activeOrganization?.toString() || token.clientId; // Keep activeOrganization in sync with clientId

				const { getRolePermissions } = await import("./lib/permissions");
				token.permissions = await getRolePermissions(token.role as string);
			}

			// This is the "Real-Time" magic part,
			if (trigger === "update" && session) {

				if (session.role) {
					token.role = session.role;
				}
				if (session?.clientId) {
					if (token.role === ROLES.SUPERADMIN) {
						token.clientId = session.clientId === 'all' ? null : new ObjectId(session.clientId); // Superadmin can switch to 'all' or specific client
					} else {
						const clientData = await switchClient(session.clientId, token);
						// Keep the current context if the user doesn't belong to the requested org,
						// instead of leaving the token with a null role
						if (clientData) {
							token.clientId = clientData.clientId;
							token.activeOrganization = clientData.clientId;
							token.role = clientData.role;
							token.permissions = clientData.permissions;
							token.organizations = clientData.organizations;
						}
					}
				}
				if (session.clientCode) token.clientCode = session.clientCode;
				if (session.isActive !== undefined) token.isActive = session.isActive;
				if (session.organizations) token.organizations = session.organizations;
			}

			// Pending users wait for an admin's approval, which only changes the DB.
			// Re-read their membership so they leave the "pending" screen without signing in again.
			if (!user && token.role === ROLES.PENDING_USER && token.clientId) {
				const clientData = await switchClient(token.clientId.toString(), token);
				if (clientData && clientData.role !== token.role) {
					token.role = clientData.role;
					token.permissions = clientData.permissions;
					token.organizations = clientData.organizations;
				}
			}
			return token;
		},
		async session({ session, token }) {
			if (session.user) {
				// Direct assignment from the token we prepared above
				session.user.role = token.role as string;
				session.user.clientId = token.clientId as string;
				session.user.clientCode = token.clientCode as string
				session.user.isActive = token.isActive as boolean;
				session.user.permissions = token.permissions as any;
				session.user.organizations = token.organizations as any; // Ensure organizations is always defined
				session.user.activeOrganization = token.clientId as string; // Keep activeOrganization in sync with clientId
			}
			return session;
		},
		authorized: async ({ auth }) => {
			// Logged in users are authenticated, otherwise redirect to login page
			return !!auth
		},
	},
	session: { strategy: 'jwt' }, // Recommended for most role-based apps,
});


/**
 * Switches the client for the user based on the requested clientId and resolves the new role and permissions.
 * This is useful for users who belong to multiple organizations and need to switch contexts without logging out.
 * @param clientId - The clientId of the organization to switch to.
 * @param token - The current JWT token payload containing user information such as email.
 * @returns A promise resolving to the clientId, role, permissions and organizations for the selected organization,
 * or null if the user doesn't belong to it.
 */
async function switchClient(clientId: string, token: any) {
    const userDoc = await db.collection('users').findOne({ email: token.email });
    const organizations = (userDoc?.organizations || []).filter((o: any) => !isPlaceholderOrg(o));
    const orgData = organizations.find((o: any) => o.clientId.toString() === clientId);

    if (!orgData) return null;

    const { getRolePermissions } = await import("./lib/permissions");
    return {
        // Keep it as a string here!
        clientId: orgData.clientId.toString(),
        role: orgData.role,
        permissions: await getRolePermissions(orgData.role),
        organizations: organizations.map((org: any) => ({ ...org, clientId: org.clientId.toString() })),
    };
}