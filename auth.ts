import NextAuth from "next-auth"
import "next-auth/jwt"
import Google from "next-auth/providers/google"
import { createStorage } from "unstorage"
import memoryDriver from "unstorage/drivers/memory"
import { UnstorageAdapter } from "@auth/unstorage-adapter"

const storage = createStorage({
  driver: memoryDriver(),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  debug: !!process.env.AUTH_DEBUG,
  theme: { logo: "https://authjs.dev/img/logo-sm.png" },
  adapter: UnstorageAdapter(storage),
  providers: [
    Google({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_ID_CLIENT as string,
      clientSecret: process.env.NEXT_PUBLIC_GOOGLE_API_SECRET as string,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl
      if (pathname === "/middleware-example") return !!auth
      return true
    },
    jwt({ token, trigger, session, account }) {
      if (trigger === "update") token.name = session.user.name
      if (account?.provider === "keycloak") {
        return { ...token, accessToken: account.access_token }
      }
      return token
    },
    async session({ session, token }) {
      if (token?.accessToken) session.accessToken = token.accessToken

      return session
    },
  }
})

declare module "next-auth" {
  interface Session {
    accessToken?: string
  }

  interface CallbacksOptions<P, A> {
    authorized?: (params: { request: any; auth: any }) => boolean | Promise<boolean>
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
  }
}
