import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import clientPromise from "@/lib/mongodb"
import { getSuperAdminEmail, ROLES } from "./lib/constants"
import mongo from "@/lib/mongodb";


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
					organizations: profile.organizations || [] // Array of orgs the user belongs to
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
						{ $set: { organizations: organizations } }
					);
				}

				if (user.email === SUPERADMIN_EMAIL) {
					token.role = ROLES.SUPERADMIN;
					token.clientId = session?.clientId || user.clientId || 'all';
				} else {
					// For regular users, we pick the first active org as default
					const activeOrg = organizations[0];
					token.role = activeOrg?.role || "new_user";
					token.clientId = activeOrg?.clientId?.toString() || 'sup';
				}

				const { getRolePermissions } = await import("./lib/permissions");
				token.permissions = await getRolePermissions(token.role as string);
			}

			// This is the "Real-Time" magic part,
			if (trigger === "update" && session) {

				if (session.role) token.role = session.role;
				if (session.clientId) {


					const clientData = await switchClient(session, token);
					if (token.role === ROLES.SUPERADMIN) {
						token.clientId = session.clientId === 'all' ? null : session.clientId; // Superadmin can switch to 'all' or specific client
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

	// Find the user's specific role for THIS specific organization
	// This assumes your User doc has an 'organizations' array
	const userDoc = await db.collection('users').findOne({ email: token.email });
	const orgData = userDoc?.organizations?.find((o: any) => o.clientId.toString() === session.clientId);

	if (orgData) {
		resultToken.clientId = session.clientId;
		resultToken.role = orgData.role;
		const { getRolePermissions } = await import("./lib/permissions");
		resultToken.permissions = await getRolePermissions(orgData.role);
	}
	return resultToken;
}