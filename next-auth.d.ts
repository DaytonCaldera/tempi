import { DefaultSession } from "next-auth"
import type { SessionMembership } from "@/types/models"

declare module "next-auth" {
  interface User {
    role?: string
    clientId?: string | null
    clientCode?: string
    activeOrganization?: string | null
    isActive?: boolean
    permissions?: Record<string, boolean>
    organizations?: SessionMembership[]
  }

  interface Session {
    user: {
      role: string
      clientId?: string
      clientCode?: string
      activeOrganization?: string
      isActive?: boolean
      permissions?: Record<string, boolean>
      organizations?: SessionMembership[]
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string
    clientId?: string | null
    clientCode?: string
    activeOrganization?: string | null
    isActive?: boolean
    permissions?: Record<string, boolean>
    organizations?: SessionMembership[]
  }
}
