import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import type { Session } from "next-auth";
import { requirePermission } from "@/lib/authorize";
import { apiError, badRequest, forbidden, getDb, notFound, serverError, toObjectId, unauthorized } from "@/lib/api";
import { PERMISSIONS } from "@/lib/constants";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { countRoleMembers, forgetCachedRoles, listCustomRoles } from "@/lib/roles";
import { cleanRoleName, covers, roleNameTaken, sanitizePermissions } from "@/lib/role-rules";
import type { Role } from "@/types/models";

type Params = { params: Promise<{ id: string }> };

/**
 * The organization's role with that id, if the user may change it: one with a permission they lack is above
 * them (a manager can't edit or delete the role admins gave them more than). Built-in roles have no clientId,
 * so they never match.
 */
async function findOwnRole(session: Session, params: Params["params"]): Promise<{ role: Role; clientId: ObjectId } | { error: NextResponse }> {
    const clientId = toObjectId(session.user.clientId);
    if (!clientId) return { error: await unauthorized() };
    const roleId = toObjectId((await params).id);
    if (!roleId) return { error: await notFound("roleNotFound") };

    const db = await getDb();
    const role = await db.collection<Role>("roles").findOne({ _id: roleId, clientId });
    if (!role) return { error: await notFound("roleNotFound") };
    if (!covers(session.user.permissions, role.permissions)) return { error: await forbidden("roleAboveYours") };
    return { role, clientId };
}

/**
 * PATCH /api/admin/roles/[id] - Renames a role of the organization and changes its permissions.
 * Body: { name, permissions }. Its members get the new permissions within seconds (lib/roles.ts caches them).
 */
export async function PATCH(req: Request, { params }: Params) {
    const { session, error } = await requirePermission(PERMISSIONS.MANAGE_ROLES);
    if (error) return error;

    try {
        const found = await findOwnRole(session, params);
        if ("error" in found) return found.error;
        const { role, clientId } = found;

        const body = await req.json().catch(() => null);
        const name = cleanRoleName(body?.name);
        if (!name) return badRequest("roleNameRequired");
        const permissions = sanitizePermissions(body?.permissions);
        if (!covers(session.user.permissions, permissions)) return forbidden("roleAboveYours");
        if (roleNameTaken(await listCustomRoles(clientId), name, role._id.toString())) return apiError("roleNameTaken", 409);

        const db = await getDb();
        await db.collection<Role>("roles").updateOne({ _id: role._id }, { $set: { name, permissions, updatedAt: new Date() } });
        forgetCachedRoles();
        await logAudit(AUDIT_ACTIONS.UPDATE_ROLE, {
            actor: session.user, clientId, target: { type: "role", id: role._id, label: name },
            details: { before: { name: role.name, permissions: role.permissions }, after: { name, permissions } },
        });

        return NextResponse.json({ _id: role._id.toString(), slug: role.slug, name, permissions });
    } catch (error) {
        console.error("PATCH role error:", error);
        return serverError();
    }
}

/** DELETE /api/admin/roles/[id] - Deletes a role of the organization that no member has (roleInUse otherwise). */
export async function DELETE(_req: Request, { params }: Params) {
    const { session, error } = await requirePermission(PERMISSIONS.MANAGE_ROLES);
    if (error) return error;

    try {
        const found = await findOwnRole(session, params);
        if ("error" in found) return found.error;
        const { role, clientId } = found;

        // Its members would be left with no permissions: they get another role first
        const members = await countRoleMembers(clientId, role.slug);
        if (members > 0) return apiError("roleInUse", 409, { count: members });

        const db = await getDb();
        await db.collection<Role>("roles").deleteOne({ _id: role._id, clientId });
        forgetCachedRoles();
        await logAudit(AUDIT_ACTIONS.DELETE_ROLE, {
            actor: session.user, clientId, target: { type: "role", id: role._id, label: role.name },
            details: { permissions: role.permissions },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE role error:", error);
        return serverError();
    }
}
