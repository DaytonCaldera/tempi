import type { Session } from "next-auth";
import { ROLES } from "./constants";

/**
 * Checks a permission against the session (safe to use in server and client components).
 * The session's permissions are loaded from the role at sign-in, see lib/roles.
 */
export const hasPermission = (session: Session | null | undefined, permissionKey: string): boolean => {
    // The superadmin only uses the /superadmin panel, never an organization's pages or APIs
    if (session?.user?.role === ROLES.SUPERADMIN) return false;
    return !!session?.user?.permissions?.[permissionKey];
};

/** The session's membership in its active organization (safe to use in server and client components). */
export const activeMembership = (session: Session | null | undefined) =>
    session?.user?.organizations?.find(m => m.clientId === session.user.clientId);
