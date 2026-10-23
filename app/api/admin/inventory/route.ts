import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, serverError, unauthorized } from '@/lib/api';
import { assignedDepartmentIds } from '@/lib/departments';

/** GET /api/admin/inventory - Stock of the departments the user is assigned to in their active organization. */
export async function GET() {
    const session = await auth();
    if (!session?.user) return unauthorized();

    try {
        const departmentIds = assignedDepartmentIds(session);
        if (departmentIds.length === 0) return NextResponse.json([]);

        const db = await getDb();
        const inventory = await db.collection('department_stock')
            .find({ departmentId: { $in: departmentIds }, isDeleted: { $ne: true } })
            .sort({ productName: 1 })
            .toArray();

        return NextResponse.json(inventory.map(item => ({
            ...item,
            _id: item._id.toString(),
            departmentId: item.departmentId.toString(),
        })));
    } catch (error) {
        console.error("GET inventory error:", error);
        return serverError();
    }
}
