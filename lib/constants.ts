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

export const isSuperAdmin = (session: any) => {
    if (!process.env.ADMIN_EMAILS) return false;
    const masterEmails = process.env.ADMIN_EMAILS?.split(',').map(email => email.trim().toLowerCase()) || [];
    return session?.user?.role === ROLES.SUPERADMIN && masterEmails.includes(session.user.email);
};

//return the admin email from SUPERADMIN_EMAIL env variable, if not set return the default email
export const getSuperAdminEmail = (): string => {
    return process.env.SUPERADMIN_EMAIL || "superadmin@tempi.pro";
}

export const sectionPermissions: Record<string, string> = {
    admin: PERMISSIONS.MANAGE_USERS,       // O el permiso que definas en tu JSON de roles
    inventory: PERMISSIONS.VIEW_STOCK,
    reports: PERMISSIONS.VIEW_REPORTS
};

export const sectionItemPermissions: Record<string, string> = {
    "admin_users": "manage_users",
    "admin_clients": "manage_clients"
};