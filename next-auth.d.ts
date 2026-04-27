import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface User {
    role?: string // Add your custom field here
    clientId?: string
    clientCode?: string
    isActive?: boolean
    permissions?: Record<string, any> // Add permissions field to the User interface
  }

  interface Session {
    user: {
      role: string
      clientId?: string
      clientCode?: string
      isActive?: boolean
      permissions?: Record<string, any>
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string
    clientId?: string
    clientCode?: string
    isActive?: boolean
    permissions?: Record<string, any>
  }
}