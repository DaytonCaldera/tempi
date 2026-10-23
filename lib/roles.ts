import { getDb } from "@/lib/api";

/**
 * Server only: loads the permissions of a role from the "roles" collection
 * (e.g. { manage_users: true, ... }). The result is stored in the session at sign-in.
 * For checking a permission in a page or component, use hasPermission from lib/permissions.
 */
export async function getRolePermissions(roleSlug: string): Promise<Record<string, boolean>> {
    const db = await getDb();
    const roleDoc = await db.collection('roles').findOne({ slug: roleSlug });
    return roleDoc?.permissions || {};
}
