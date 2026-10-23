import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { PERMISSIONS } from "@/lib/constants";
import { getDb, toObjectId, unauthorized } from "@/lib/api";

/** GET /api/admin/departments/personnel?deptId= - Users assigned to a department: `{ users: [{ _id, name, isActive, role }] }` */
export async function GET(req: Request) {
    const { session, error } = await requirePermission(PERMISSIONS.MANAGE_DEPTS);
    if (error) return error;
    const clientId = toObjectId(session.user.activeOrganization);
    if (!clientId) return unauthorized();

    const departmentId = toObjectId(new URL(req.url).searchParams.get('deptId'));
    if (!departmentId) return NextResponse.json({ users: [] });

    const membershipInDepartment = { clientId, departments: departmentId };

    const db = await getDb();
    const users = await db.collection('users')
        .find({ organizations: { $elemMatch: membershipInDepartment } })
        .project({
            name: 1,
            isActive: 1,
            // $elemMatch in a projection returns only the matching membership, not the whole array
            organizations: { $elemMatch: membershipInDepartment }
        })
        .toArray();

    return NextResponse.json({
        users: users.map(user => ({
            _id: user._id.toString(),
            name: user.name,
            isActive: user.isActive,
            role: user.organizations?.[0]?.role ?? null
        }))
    });
}
