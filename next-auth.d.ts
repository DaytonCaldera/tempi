import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface User {
    role?: string // Add your custom field here
    clientId?: string
    clientCode?: string
    isActive?: boolean
  }

  interface Session {
    user: {
      role: string
      clientId?: string
      clientCode?: string
      isActive?: boolean
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string
    clientId?: string
    clientCode?: string
    isActive?: boolean
  }
}