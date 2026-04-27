import { ROLES } from "./constants";

/**
 * Checks if a specific role has a required permission.
 * In a real-world scenario, you might fetch this from the DB and cache it.
 * For now, we use the session data which will contain the role's permission set.
 */
export const hasPermission = (userSession: any, permissionKey: string): boolean => {
    // 1. Superadmin Bypass
    if (userSession?.user?.role === ROLES.SUPERADMIN) return true;

    // 2. Access the permissions object stored in the session
    // (We will need to ensure auth.ts includes the permissions object from the roles collection)
    const permissions = userSession?.user?.permissions || {};
    
    return !!permissions[permissionKey];
};