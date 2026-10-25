import { redirect } from "next/navigation";
import type { ObjectId } from "mongodb";
import { auth } from "@/auth";
import { getDb, toObjectId } from "@/lib/api";
import { PERMISSIONS, ROLES } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";
import { getRolePermissions, listCustomRoles } from "@/lib/roles";
import { covers, sanitizePermissions } from "@/lib/role-rules";
import RolesManagementClient, { type RoleRow } from "./RolesManagementClient";

/** Members of the organization per role slug, any status. */
async function membersPerRole(clientId: ObjectId) {
    const db = await getDb();
    // Memberships migrated from the old top-level clientId may store it as a string
    const anyIdForm = { $in: [clientId, clientId.toString()] };
    const rows = await db.collection("users").aggregate<{ _id: string; count: number }>([
        { $match: { "organizations.clientId": anyIdForm } },
        { $unwind: "$organizations" },
        { $match: { "organizations.clientId": anyIdForm } },
        { $group: { _id: "$organizations.role", count: { $sum: 1 } } },
    ]).toArray();
    return new Map(rows.map(r => [r._id, r.count]));
}

export default async function RolesManagementPage() {
    const session = await auth();
    if (!session) redirect("/");
    if (!hasPermission(session, PERMISSIONS.MANAGE_ROLES)) redirect("/unauthorized");
    const clientId = toObjectId(session.user.clientId);
    if (!clientId) redirect("/lobby");

    const own = session.user.permissions;
    const [custom, counts, adminPermissions, userPermissions] = await Promise.all([
        listCustomRoles(clientId),
        membersPerRole(clientId),
        getRolePermissions(ROLES.ADMIN, clientId),
        getRolePermissions(ROLES.USER, clientId),
    ]);

    const builtIn = (slug: string, permissions: Record<string, boolean>): RoleRow => ({
        _id: slug, slug, name: null, builtIn: true, editable: false,
        permissions: sanitizePermissions(permissions), members: counts.get(slug) ?? 0,
    });
    const roles: RoleRow[] = [
        builtIn(ROLES.ADMIN, adminPermissions),
        builtIn(ROLES.USER, userPermissions),
        ...custom.map(role => ({
            _id: role._id.toString(), slug: role.slug, name: role.name, builtIn: false,
            // Roles above the user's own permissions are shown, but can't be changed (see app/api/admin/roles/[id])
            editable: covers(own, role.permissions),
            permissions: sanitizePermissions(role.permissions), members: counts.get(role.slug) ?? 0,
        })),
    ];

    return (
        <div className="p-6 lg:p-10">
            <RolesManagementClient roles={roles} ownPermissions={sanitizePermissions(own)} />
        </div>
    );
}
