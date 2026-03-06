import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import clientPromise from "@/lib/mongodb" // Your MongoClient promise file

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    Google({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_ID_CLIENT as string,
      clientSecret: process.env.GOOGLE_API_SECRET as string,
      profile(profile) {
        // This maps the Google profile to your database User document
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          role: profile.role ?? "user",
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        console.log("✅ New User detected, attempting to save to DB:", user);
      } else {
        console.log("ℹ️ Existing session (no DB write triggered)");
      }
      if (user) token.role = user.role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // Direct assignment from the token we prepared above
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  session: { strategy: "jwt" }, // Recommended for most role-based apps
})