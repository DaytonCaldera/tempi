import { NextResponse } from 'next/server';
import { auth } from "@/auth";
import { badRequest, getDb, notFound, toObjectId, unauthorized } from '@/lib/api';
import { ROLES } from '@/lib/constants';

/**
 * POST /api/admin/users/approve - Approves a pending user in the admin's organization
 * and assigns them to a department. Body: { userId, deptId }
 */
export async function POST(req: Request) {
    const session = await auth();
    const clientId = toObjectId(session?.user?.clientId);
    if (!session || !clientId || session.user.role === ROLES.USER) return unauthorized();

    const { userId, deptId } = await req.json();
    const userObjectId = toObjectId(userId);
    const departmentId = toObjectId(deptId);
    if (!userObjectId || !departmentId) return badRequest();

    const db = await getDb();
    const result = await db.collection('users').updateOne(
        { _id: userObjectId, "organizations.clientId": clientId },
        {
            $set: {
                "organizations.$.role": ROLES.USER,
                "organizations.$.status": 'active',
                "organizations.$.departments": [departmentId]
            }
        }
    );
    if (result.matchedCount === 0) return notFound("userNotFound");

    return NextResponse.json({ success: true });
}
