export const ROLES = {
    SUPERADMIN: "superadmin",
    ADMIN: "admin",
    USER: "user",
    PENDING_USER: "pending_user",
    NEW_USER: "new_user",
}

export const isSuperAdmin = (session: any) => {
    if(!process.env.ADMIN_EMAILS) return false;
    const masterEmails = process.env.ADMIN_EMAILS?.split(',').map(email => email.trim().toLowerCase()) || [];
    return session?.user?.role === ROLES.SUPERADMIN && masterEmails.includes(session.user.email);
};

//return the admin email from SUPERADMIN_EMAIL env variable, if not set return the default email
export const getSuperAdminEmail = (): string => {
    return process.env.SUPERADMIN_EMAIL || "superadmin@example.com";
}