import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import clientPromise from "@/lib/mongodb" // Your MongoClient promise file



export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    Google({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_ID_CLIENT as string,
      clientSecret: process.env.NEXT_PUBLIC_GOOGLE_API_SECRET as string,
      profile(profile) {
        // This maps the Google profile to your database User document
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          role: profile.role ?? "new_user", // Default role for new users
          clientId: profile.clientId ?? null,
          clientCode: profile.clientCode ?? null,
          isActive: profile.isActive ?? true,
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role;
        token.clientId = user.clientId;
        token.clientCode = user.clientCode;
        token.isActive = user.isActive;
      }

      // This is the "Real-Time" magic part,
      if (trigger === "update" && session) {
        if (session.role) token.role = session.role;
        if (session.clientId) token.clientId = session.clientId;
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