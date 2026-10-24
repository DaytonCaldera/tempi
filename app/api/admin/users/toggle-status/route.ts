import { NextResponse } from 'next/server';
import type { ObjectId } from 'mongodb';
import { requirePermission } from "@/lib/authorize";
import { apiError, badRequest, forbidden, getDb, notFound, serverError, toObjectId } from '@/lib/api';
import { PERMISSIONS, ROLES } from "@/lib/constants";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { isOrganizationOwner } from "@/lib/organizations";
import { planLimitError } from "@/lib/plans";
import { forgetCachedUsers } from "@/lib/users";
import type { Organization, User } from "@/types/models";

/** Roles that can be given from the staff page. Superadmin only comes from SUPERADMIN_EMAIL (see auth.ts). */
const ASSIGNABLE_ROLES: string[] = [ROLES.USER, ROLES.ADMIN];

/**
 * PATCH /api/admin/users/toggle-status
 * Updates a user's membership in an organization: active/inactive, role and departments.
 * Body: { userId, isActive, departments: string[], role }
 *
 * - The role must be one of ASSIGNABLE_ROLES and every department must belong to the organization.
 * - Admins can't edit their own membership, and the owner always stays an active admin.
 * - Approving or reactivating a member needs room in the organization's plan (lib/plans.ts).
 */
export async function PATCH(request: Request) {
    const { session, error } = await requirePermission(PERMISSIONS.MANAGE_USERS);
    if (error) return error;

    try {
        const { userId, isActive, departments, role } = await request.json();

        if (!ASSIGNABLE_ROLES.includes(role)) return badRequest("invalidRole");
        if (typeof isActive !== "boolean" || !Array.isArray(departments)) return badRequest();

        // Admins can only edit memberships of their own organization
        const clientId = toObjectId(session.user.clientId);
        const userObjectId = toObjectId(userId);
        if (!clientId || !userObjectId) return badRequest();

        const departmentIds = departments.map(toObjectId).filter((id): id is ObjectId => id !== null);
        if (departmentIds.length !== departments.length) return badRequest("invalidDepartment");

        const db = await getDb();
        const [target, organization, ownDepartments] = await Promise.all([
            db.collection<User>('users').findOne({ _id: userObjectId }, { projection: { email: 1, name: 1, organizations: 1 } }),
            db.collection<Organization>('clients').findOne({ _id: clientId }, { projection: { ownerEmail: 1 } }),
            db.collection('departments').countDocuments({ _id: { $in: departmentIds }, clientId }),
        ]);
        if (!target || !organization) return notFound("userOrOrganizationNotFound");
        // A department of another organization would give the user that organization's stock
        if (ownDepartments !== new Set(departmentIds.map(String)).size) return notFound("departmentNotFound");

        if (target.email?.toLowerCase() === session.user.email?.toLowerCase()) return forbidden("cannotEditSelf");
        if (isOrganizationOwner(target.email, organization) && (role !== ROLES.ADMIN || !isActive)) {
            return apiError("ownerLocked", 403);
        }
        const before = target.organizations?.find(m => m.clientId.toString() === clientId.toString());
        // Only members who start counting take room in the plan: changes to active members never do
        const counted = before?.status === "active" && before.role !== ROLES.PENDING_USER;
        if (isActive && !counted) {
            const limitError = await planLimitError(clientId, "users");
            if (limitError) return limitError;
        }

        // Memberships migrated from the old top-level clientId may store it as a string
        const result = await db.collection('users').updateOne(
            { _id: userObjectId, organizations: { $elemMatch: { clientId: { $in: [clientId, clientId.toString()] } } } } as object,
            {
                $set: {
                    // '$' updates the membership matched in the filter
                    "organizations.$.status": isActive ? 'active' : 'inactive',
                    "organizations.$.role": role,
                    "organizations.$.departments": departmentIds,
                }
            }
        );
        if (result.matchedCount === 0) return notFound("userOrOrganizationNotFound");
        forgetCachedUsers();
        await logAudit(AUDIT_ACTIONS.UPDATE_MEMBER, {
            actor: session.user, clientId, target: { type: "user", id: userObjectId, label: target.name },
            details: {
                before: { role: before?.role ?? null, status: before?.status ?? null, departments: before?.departments?.map(String) ?? [] },
                after: { role, status: isActive ? "active" : "inactive", departments: departmentIds.map(String) },
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("PATCH user status error:", error);
        return serverError();
    }
}
