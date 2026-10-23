import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, serverError, unauthorized } from '@/lib/api';
import type { User } from '@/types/models';

/** GET /api/admin/inventory - Stock of the departments the user is assigned to in their active organization. */
export async function GET() {
    const session = await auth();
    if (!session?.user) return unauthorized();

    try {
        const db = await getDb();
        const userDoc = await db.collection<User>("users").findOne({ email: session.user.email ?? undefined });

        const membership = userDoc?.organizations?.find(m => m.clientId.toString() === session.user.clientId);
        const departmentIds = membership?.departments || [];
        if (departmentIds.length === 0) return NextResponse.json([]);

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
