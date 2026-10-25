import { CUSTOM_ROLE_PREFIX, PERMISSIONS, ROLE_NAME_MAX_LENGTH, ROLE_PERMISSIONS, ROLES } from "@/lib/constants";

/**
 * Rules for roles that need no database, shared by the server (lib/roles.ts, the roles and staff APIs) and
 * the pages that show which roles a member may give.
 */

export type Permissions = Record<string, boolean>;

/** Roles from the staff page can be given besides the organization's own ones. */
export const ASSIGNABLE_BUILT_IN_ROLES: string[] = [ROLES.USER, ROLES.ADMIN];

/**
 * Permissions that built-in roles get even when their document in "roles" doesn't list them: the ones added
 * after those documents were seeded, so databases need no migration. The document still wins when it says
 * false. Admins get every permission an organization can give, so they can always give any role.
 */
const BUILT_IN_DEFAULTS: Record<string, Permissions> = {
    [ROLES.ADMIN]: Object.fromEntries(ROLE_PERMISSIONS.map(p => [p, true])),
    [ROLES.USER]: { [PERMISSIONS.MOVE_STOCK]: true },
};

/** The permissions of a built-in role: its defaults, then what its document says. */
export function withBuiltInDefaults(slug: string, stored: Permissions | null | undefined): Permissions {
    return { ...BUILT_IN_DEFAULTS[slug], ...stored };
}

export const isCustomRole = (slug: string | null | undefined) => !!slug?.startsWith(CUSTOM_ROLE_PREFIX);

/**
 * The permissions in `role` that `own` lacks, among the ones organizations give (ROLE_PERMISSIONS).
 * Nobody may give, edit or take away a role with any of them: a manager can't create a role above
 * their own, nor demote an admin.
 */
export function missingPermissions(role: Permissions | null | undefined, own: Permissions | null | undefined): string[] {
    return ROLE_PERMISSIONS.filter(p => role?.[p] && !own?.[p]);
}

export const covers = (own: Permissions | null | undefined, role: Permissions | null | undefined) =>
    missingPermissions(role, own).length === 0;

/** Only the permissions organizations give, each as true or false. Anything else in `input` is dropped. */
export function sanitizePermissions(input: unknown): Permissions {
    const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
    return Object.fromEntries(ROLE_PERMISSIONS.map(p => [p, source[p] === true]));
}

/**
 * Whether another role of the organization already has that name, ignoring case and accents, so the staff
 * page never offers two roles that read the same.
 */
export const roleNameTaken = (roles: { _id: { toString(): string }; name: string }[], name: string, exceptId?: string) =>
    roles.some(r => r._id.toString() !== exceptId && r.name.localeCompare(name, undefined, { sensitivity: "base" }) === 0);

/** A role name as stored: trimmed, single spaces. Null when empty or too long. */
export function cleanRoleName(input: unknown): string | null {
    if (typeof input !== "string") return null;
    const name = input.trim().replace(/\s+/g, " ");
    return name && name.length <= ROLE_NAME_MAX_LENGTH ? name : null;
}
