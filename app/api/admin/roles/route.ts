import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError, badRequest, forbidden, getDb, serverError, toObjectId, unauthorized } from "@/lib/api";
import { MAX_CUSTOM_ROLES, PERMISSIONS } from "@/lib/constants";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { forgetCachedRoles, listCustomRoles, newCustomRoleSlug } from "@/lib/roles";
import { cleanRoleName, covers, roleNameTaken, sanitizePermissions } from "@/lib/role-rules";

/**
 * POST /api/admin/roles - Creates a role of the user's organization. Body: { name, permissions: { [key]: boolean } }
 * Only the permissions in ROLE_PERMISSIONS are kept, and the user must have every one it gives (lib/role-rules.ts).
 */
export async function POST(req: Request) {
    const { session, error } = await requirePermission(PERMISSIONS.MANAGE_ROLES);
    if (error) return error;

    try {
        const clientId = toObjectId(session.user.clientId);
        if (!clientId) return unauthorized();

        const body = await req.json().catch(() => null);
        const name = cleanRoleName(body?.name);
        if (!name) return badRequest("roleNameRequired");
        const permissions = sanitizePermissions(body?.permissions);
        if (!covers(session.user.permissions, permissions)) return forbidden("roleAboveYours");

        const existing = await listCustomRoles(clientId);
        if (existing.length >= MAX_CUSTOM_ROLES) return apiError("tooManyRoles", 409, { limit: MAX_CUSTOM_ROLES });
        if (roleNameTaken(existing, name)) return apiError("roleNameTaken", 409);

        const role = {
            slug: newCustomRoleSlug(), name, clientId, permissions,
            createdAt: new Date(), createdBy: session.user.email ?? undefined,
        };
        const db = await getDb();
        const { insertedId } = await db.collection("roles").insertOne(role);
        forgetCachedRoles();
        await logAudit(AUDIT_ACTIONS.CREATE_ROLE, {
            actor: session.user, clientId, target: { type: "role", id: insertedId, label: name }, details: { permissions },
        });

        return NextResponse.json({ _id: insertedId.toString(), slug: role.slug, name, permissions });
    } catch (error) {
        console.error("POST role error:", error);
        return serverError();
    }
}
