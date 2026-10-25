import { ObjectId } from "mongodb";
import { getDb, toObjectId } from "@/lib/api";
import { CUSTOM_ROLE_PREFIX, ROLES } from "@/lib/constants";
import { ASSIGNABLE_BUILT_IN_ROLES, isCustomRole, withBuiltInDefaults, type Permissions } from "@/lib/role-rules";
import type { Role } from "@/types/models";

/**
 * Server only. Roles live in the "roles" collection: the built-in ones (ROLES) have clientId null and are the
 * same for every organization; the ones an organization creates (/admin/roles) have its clientId and a
 * "custom_" slug, and never resolve for another organization.
 * For checking a permission in a page or component, use hasPermission from lib/permissions.
 */

/**
 * How long a role read by the session stays cached in this server process. The session resolves the role on
 * every request (see the jwt callback in auth.ts), so edits made from another process apply within this time.
 */
const ROLE_CACHE_TTL_MS = 15_000;
const ROLE_CACHE_MAX_ENTRIES = 1000;

type ResolvedRole = { name: string | null; permissions: Permissions };
const cache = new Map<string, { role: ResolvedRole | null; expiresAt: number }>();

/**
 * The role that `slug` names in the organization: a built-in one, or one of the organization's own.
 * Null when it doesn't exist there (e.g. "pending_user", which has no document, or another organization's role).
 */
export async function getRole(slug: string, clientId: ObjectId | string | null | undefined): Promise<ResolvedRole | null> {
    const orgId = toObjectId(clientId);
    const custom = isCustomRole(slug);
    if (custom && !orgId) return null;

    const key = custom ? `${orgId}:${slug}` : slug;
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) return cached.role;

    const db = await getDb();
    // clientId: null also matches the built-in documents that have no clientId field
    const doc = await db.collection<Role>("roles").findOne({ slug, clientId: custom ? orgId : null });
    const role = doc
        ? { name: custom ? doc.name : null, permissions: custom ? doc.permissions : withBuiltInDefaults(slug, doc.permissions) }
        : null;

    if (!cache.has(key) && cache.size >= ROLE_CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(key, { role, expiresAt: now + ROLE_CACHE_TTL_MS });
    return role;
}

/** Permissions of the role in the organization, {} when it has none (see getRole). Stored in the session. */
export async function getRolePermissions(slug: string, clientId: ObjectId | string | null | undefined): Promise<Permissions> {
    return (await getRole(slug, clientId))?.permissions ?? {};
}

/**
 * The role `slug` names if the staff page may give it in the organization: a built-in one it offers
 * (ASSIGNABLE_BUILT_IN_ROLES) or one of the organization's own. Null otherwise (superadmin, pending_user,
 * another organization's role).
 */
export async function getAssignableRole(slug: unknown, clientId: ObjectId) {
    if (typeof slug !== "string" || !(ASSIGNABLE_BUILT_IN_ROLES.includes(slug) || isCustomRole(slug))) return null;
    return getRole(slug, clientId);
}

/** Call after changing role documents, so this process sees the change on the next request. */
export function forgetCachedRoles() {
    cache.clear();
}

/** The organization's own roles, sorted by name. */
export async function listCustomRoles(clientId: ObjectId) {
    const db = await getDb();
    return db.collection<Role>("roles").find({ clientId }).sort({ name: 1 }).toArray();
}

/**
 * Slugs of the roles that have `permission` in the organization: built-in admin when it does, plus the
 * organization's own roles that have it. For finding members by what they can do (e.g. low stock emails).
 */
export async function roleSlugsWith(permission: string, clientId: ObjectId): Promise<string[]> {
    const custom = (await listCustomRoles(clientId)).filter(r => r.permissions?.[permission]).map(r => r.slug);
    const admin = (await getRolePermissions(ROLES.ADMIN, null))[permission] ? [ROLES.ADMIN] : [];
    return [...admin, ...custom];
}

/** Members of the organization (any status) whose membership has that role. */
export async function countRoleMembers(clientId: ObjectId, slug: string) {
    const db = await getDb();
    // Memberships migrated from the old top-level clientId may store it as a string
    return db.collection("users").countDocuments({
        organizations: { $elemMatch: { clientId: { $in: [clientId, clientId.toString()] }, role: slug } },
    } as object);
}

/** A new, unused slug for a role of an organization. */
export const newCustomRoleSlug = () => `${CUSTOM_ROLE_PREFIX}${new ObjectId().toHexString()}`;
