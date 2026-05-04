import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import clientPromise from "@/lib/mongodb"
import { getSuperAdminEmail, ROLES } from "./lib/constants"
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
					clientId: profile.clientId ?? 'sup22',
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
				let organizations = userDoc?.organizations || [];

				// 2. MIGRATION LOGIC: If no organizations exist, create the first one from old data
				if (organizations.length === 0 && user.clientId) {
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
					token.clientId = session?.activeOrganization?.toString() || user.activeOrganization?.toString() || 'all';
				} else {
					// FIX: Find the organization that matches the user's current "assigned" clientId
					// We use .toString() to ensure we are comparing strings to strings
					const currentId = user.activeOrganization?.toString() || organizations[0]?.clientId?.toString(); // Fallback to first org if activeOrganization is not set
					const activeOrg = organizations.find((org: any) =>
						org.clientId.toString() === currentId && org.status === 'active'
					);

					// Fallback: If the user has active orgs but currentId didn't match, pick the first active one
					const effectiveOrg = activeOrg || organizations.find((o: any) => o.status === 'active');

					token.role = effectiveOrg?.role || "new_user";
					// ALWAYS store as string in the token to avoid BSON Errors in the session
					token.clientId = effectiveOrg?.clientId?.toString() || null;
					token.organizations = organizations; // Store all orgs in the token for easy access in the app
					console.log(token);
					
				}

				const { getRolePermissions } = await import("./lib/permissions");
				token.permissions = await getRolePermissions(token.role as string);
			}

			// This is the "Real-Time" magic part,
			if (trigger === "update" && session) {

				if (session.role) {
					token.role = session.role; console.log(token, 'TOKEN UPDATE');
				}
				if (session.clientId) {

					const clientData = await switchClient(session, token);
					if (token.role === ROLES.SUPERADMIN) {
						token.clientId = session.clientId === 'all' ? null : new ObjectId(session.clientId); // Superadmin can switch to 'all' or specific client
					} else {
						token.clientId = clientData.clientId;
						token.role = clientData.role;
						token.permissions = clientData.permissions;
					}
					
				}
				if (session.clientCode) token.clientCode = session.clientCode;
				if (session.isActive !== undefined) token.isActive = session.isActive;
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
 * Switches the client for the user based on the session's clientId and updates the token with the new role and permissions.
 * This is useful for users who belong to multiple organizations and need to switch contexts without logging out.
 * @param session - The current session object containing the selected clientId and any updated session values.
 * @param token - The current JWT token payload containing user information such as email.
 * @returns A promise resolving to an object with the resolved clientId, role, and permissions for the selected organization.
 */
async function switchClient(session: any, token: any) {
    const resultToken = {
        clientId: null,
        role: null,
        permissions: null,
    };

    const userDoc = await db.collection('users').findOne({ email: token.email });
    const orgData = userDoc?.organizations?.find((o: any) => o.clientId.toString() === session.clientId);

    if (orgData) {
        // Keep it as a string here!
        resultToken.clientId = orgData.clientId.toString();
        resultToken.role = orgData.role;
        const { getRolePermissions } = await import("./lib/permissions");
        resultToken.permissions = await getRolePermissions(orgData.role);
    }
    return resultToken;
}