import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, notFound, serverError, toObjectId, unauthorized } from '@/lib/api';
import { findOwnDepartment } from '@/lib/departments';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/departments/[id]/stock
 * Adds a product to a department's inventory.
 * Body: { name, sku, unit, quantity, minStock }
 */
export async function POST(req: Request, { params }: Params) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    try {
        const departmentId = toObjectId((await params).id);
        const department = departmentId && await findOwnDepartment(session, departmentId);
        if (!department) return notFound("departmentNotFound");

        const body = await req.json();
        const db = await getDb();

        const result = await db.collection('department_stock').insertOne({
            departmentId: department._id,
            departmentName: department.name,
            productName: body.name,
            sku: body.sku,
            unit: body.unit,
            quantity: Number(body.quantity),
            minStock: Number(body.minStock),
            updatedAt: new Date(),
            createdAt: new Date()
        });

        return NextResponse.json({ success: true, id: result.insertedId });
    } catch (error) {
        console.error("POST stock item error:", error);
        return serverError();
    }
}

/** GET /api/admin/departments/[id]/stock - The department's inventory, without soft-deleted items. */
export async function GET(req: Request, { params }: Params) {
    const session = await auth();
    if (!session?.user?.clientId) return unauthorized();

    const departmentId = toObjectId((await params).id);
    const department = departmentId && await findOwnDepartment(session, departmentId);
    if (!department) return notFound("departmentNotFound");

    const db = await getDb();
    const inventory = await db.collection('department_stock')
        .find({ departmentId: department._id, isDeleted: { $ne: true } })
        .toArray();

    return NextResponse.json(inventory.map(item => ({
        ...item,
        _id: item._id.toString(),
        departmentId: item.departmentId.toString()
    })));
}
