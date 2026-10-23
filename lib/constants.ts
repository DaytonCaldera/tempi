/**
 * Define a constant for user roles that can be used across the app
 * These are basic and general roles, more roles can be used in the database and assigned to users,
 * but these constants help ensure we have a single source of truth for role names, which helps prevent typos and makes it easier to manage roles in the future.
 */
export const ROLES = {
    SUPERADMIN: "superadmin",
    ADMIN: "admin",
    USER: "user",
    PENDING_USER: "pending_user",
    NEW_USER: "new_user",
}

/**
 * Define a constant for permissions that can be used across the app
 * This is used to ensure we have a single source of truth for permission names, which helps prevent typos and makes it easier to manage permissions in the future.
 * These permissions can be assigned to roles in the database and checked in the application logic to control access to different features and sections of the app.
 */
export const PERMISSIONS = {
    MANAGE_USERS: "manage_users",
    MANAGE_DEPTS: "manage_departments",
    VIEW_STOCK: "view_stock",
    EDIT_STOCK: "edit_inventory",
    VIEW_REPORTS: "view_reports",
    MOVE_STOCK: "move_stock",
    VIEW_ALL_CLIENTS: "view_all_clients", // Only for God Mode
}

/**
 * Placeholder clientId that older sign-ups stored before the user belonged to any organization.
 * It is not a real organization and must never be used to resolve a user's role.
 */
export const PLACEHOLDER_CLIENT_ID = "sup22";

export const isPlaceholderOrg = (org: { clientId?: { toString(): string } | null } | null | undefined) =>
    !org?.clientId || org.clientId.toString() === PLACEHOLDER_CLIENT_ID;

//return the admin email from SUPERADMIN_EMAIL env variable, if not set return the default email
export const getSuperAdminEmail = (): string => {
    return process.env.SUPERADMIN_EMAIL || "superadmin@tempi.pro";
}

/** Permission needed to see each sidebar section (see components/dashboard/menuItems.json) */
export const sectionPermissions: Record<string, string> = {
    admin: PERMISSIONS.MANAGE_USERS,
    inventory: PERMISSIONS.VIEW_STOCK,
    reports: PERMISSIONS.VIEW_REPORTS
};