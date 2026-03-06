import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import clientPromise from "@/lib/mongodb"

const handler = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    Google({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_ID_CLIENT,
      clientSecret: process.env.NEXT_PUBLIC_GOOGLE_API_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          role: (profile.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) ? "superadmin" : (profile.role) ? profile.role : "pending_user",
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = user.role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.role = token.role;
      return session;
    },
  },
  session: { strategy: "jwt" },
})

export { handler as GET, handler as POST }