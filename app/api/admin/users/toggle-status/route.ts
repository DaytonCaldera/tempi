import { NextResponse } from 'next/server';
import { requirePermission } from "@/lib/authorize";
import { badRequest, forbidden, getDb, notFound, serverError, toObjectId } from '@/lib/api';
import { PERMISSIONS, ROLES } from "@/lib/constants";
import { forgetCachedUsers } from "@/lib/users";

/**
 * PATCH /api/admin/users/toggle-status
 * Updates a user's membership in an organization: active/inactive, role and departments.
 * Body: { userId, isActive, departments: string[], role, targetClientId (superadmin only) }
 */
export async function PATCH(request: Request) {
    const { session, error } = await requirePermission(PERMISSIONS.MANAGE_USERS);
    if (error) return error;
    const isSuperadmin = session.user.role === ROLES.SUPERADMIN;

    try {
        const { userId, isActive, departments, role, targetClientId } = await request.json();

        if (role === ROLES.SUPERADMIN && !isSuperadmin) return forbidden();

        // Admins can only edit memberships of their own organization
        const clientId = toObjectId(isSuperadmin ? targetClientId : session.user.clientId);
        const userObjectId = toObjectId(userId);
        if (!clientId || !userObjectId) return badRequest();

        const db = await getDb();
        const result = await db.collection('users').updateOne(
            { _id: userObjectId, "organizations.clientId": clientId },
            {
                $set: {
                    // '$' updates the membership matched in the filter
                    "organizations.$.status": isActive ? 'active' : 'inactive',
                    "organizations.$.role": role,
                    "organizations.$.departments": (departments as string[]).map(toObjectId).filter(Boolean),
                    activeOrganization: clientId
                }
            }
        );
        if (result.matchedCount === 0) return notFound("userOrOrganizationNotFound");
        forgetCachedUsers();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("PATCH user status error:", error);
        return serverError();
    }
}
