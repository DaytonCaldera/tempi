import { ROLES } from "./constants";

export const hasPermission = (userSession: any, permissionKey: string): boolean => {
    // 1. Superadmin Bypass
    if (userSession?.user?.role === ROLES.SUPERADMIN) return true;

    // 2. Access the permissions object stored in the session
    // (We will need to ensure auth.ts includes the permissions object from the roles collection)
    const permissions = userSession?.user?.permissions || {};
    
    return !!permissions[permissionKey];
};