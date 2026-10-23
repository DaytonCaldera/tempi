import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authorize';
import { getDb, notFound, serverError, toObjectId } from '@/lib/api';
import { MOVEMENT_REASONS, PERMISSIONS } from '@/lib/constants';
import { findOwnDepartment } from '@/lib/departments';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/departments/[id]/stock
 * Adds a product to a department's inventory.
 * Body: { name, sku, unit, quantity, minStock }
 */
export async function POST(req: Request, { params }: Params) {
    const { session, error } = await requirePermission(PERMISSIONS.EDIT_STOCK);
    if (error) return error;

    try {
        const departmentId = toObjectId((await params).id);
        const department = departmentId && await findOwnDepartment(session, departmentId);
        if (!department) return notFound("departmentNotFound");

        const body = await req.json();
        const db = await getDb();
        const quantity = Number(body.quantity) || 0;
        const now = new Date();

        const result = await db.collection('department_stock').insertOne({
            departmentId: department._id,
            departmentName: department.name,
            productName: body.name,
            sku: body.sku,
            unit: body.unit,
            quantity,
            minStock: Number(body.minStock),
            updatedAt: now,
            createdAt: now
        });

        // The starting quantity is a movement too: reports work backwards from today's quantity
        if (quantity !== 0) {
            await db.collection('stock_movements').insertOne({
                inventoryId: result.insertedId,
                departmentId: department._id,
                departmentName: department.name,
                clientId: department.clientId,
                productName: body.name,
                sku: body.sku,
                type: quantity > 0 ? "IN" : "OUT",
                amount: Math.abs(quantity),
                previousBalance: 0,
                newBalance: quantity,
                reason: MOVEMENT_REASONS.INITIAL_STOCK,
                user: { id: session.user.id, name: session.user.name, email: session.user.email },
                createdAt: now
            });
        }

        return NextResponse.json({ success: true, id: result.insertedId });
    } catch (error) {
        console.error("POST stock item error:", error);
        return serverError();
    }
}

/** GET /api/admin/departments/[id]/stock - The department's inventory, without soft-deleted items. */
export async function GET(req: Request, { params }: Params) {
    const { session, error } = await requirePermission(PERMISSIONS.EDIT_STOCK);
    if (error) return error;

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
