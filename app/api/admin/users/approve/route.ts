import { NextResponse } from 'next/server';
import { requirePermission } from "@/lib/authorize";
import { badRequest, getDb, notFound, toObjectId, unauthorized } from '@/lib/api';
import { PERMISSIONS, ROLES } from '@/lib/constants';
import { findOwnDepartment } from '@/lib/departments';
import { planLimitError } from '@/lib/plans';
import { forgetCachedUsers } from '@/lib/users';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';

/**
 * POST /api/admin/users/approve - Approves a pending user in the admin's organization
 * and assigns them to a department. Body: { userId, deptId }
 * Only pending memberships are changed, so it can't be used to demote existing members.
 */
export async function POST(req: Request) {
    const { session, error } = await requirePermission(PERMISSIONS.MANAGE_USERS);
    if (error) return error;
    const clientId = toObjectId(session.user.clientId);
    if (!clientId) return unauthorized();

    const { userId, deptId } = await req.json();
    const userObjectId = toObjectId(userId);
    const departmentId = toObjectId(deptId);
    if (!userObjectId || !departmentId) return badRequest();

    if (!await findOwnDepartment(session, departmentId)) return notFound("departmentNotFound");
    // An approved member takes room in the organization's plan
    const limitError = await planLimitError(clientId, "users");
    if (limitError) return limitError;

    const db = await getDb();
    const result = await db.collection('users').updateOne(
        // '$' below updates the membership matched by $elemMatch
        { _id: userObjectId, organizations: { $elemMatch: { clientId, role: ROLES.PENDING_USER } } },
        {
            $set: {
                "organizations.$.role": ROLES.USER,
                "organizations.$.status": 'active',
                "organizations.$.departments": [departmentId]
            }
        }
    );
    if (result.matchedCount === 0) return notFound("userNotFound");
    forgetCachedUsers();
    const approved = await db.collection('users').findOne({ _id: userObjectId }, { projection: { name: 1 } });
    await logAudit(AUDIT_ACTIONS.APPROVE_MEMBER, {
        actor: session.user, clientId, target: { type: "user", id: userObjectId, label: approved?.name }, details: { departments: [deptId] },
    });

    return NextResponse.json({ success: true });
}
