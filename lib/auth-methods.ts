import { ROLES } from "@/lib/constants";

/**
 * Sign-in methods that are configured. Email links and Microsoft turn on only when their env vars are set
 * (see auth.ts), so the login page never shows a button that would fail.
 */
export const SIGN_IN_METHODS = {
    google: true,
    email: !!process.env.AUTH_RESEND_KEY && !!process.env.EMAIL_FROM,
    microsoft: !!process.env.AUTH_MICROSOFT_ENTRA_ID_ID && !!process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
};

export type SignInMethods = typeof SIGN_IN_METHODS;

/** Fields every new user document starts with, whatever method they signed up with (set in auth.ts createUser). */
export const NEW_USER_DEFAULTS = {
    role: ROLES.NEW_USER,
    clientId: null, // New users get an organization when they create or join one in the lobby
    isActive: true,
    permissions: {},
    organizations: [],
    activeOrganization: null,
};

/**
 * A readable name for users whose sign-in method gives none (email links): "maria.lopez+events@x.com" → "Maria Lopez".
 * Lists of users, movements and the audit log show the name, so it shouldn't be empty.
 */
export function nameFromEmail(email: string) {
    const local = email.split("@")[0].split("+")[0];
    const words = local.split(/[._-]+/).filter(Boolean);
    if (words.length === 0) return email;
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
