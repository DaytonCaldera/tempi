import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authorize';
import { apiError, badRequest, getDb, isDuplicateKeyError, notFound, serverError, toObjectId } from '@/lib/api';
import { MOVEMENT_REASONS, PERMISSIONS } from '@/lib/constants';
import { findOwnDepartment } from '@/lib/departments';
import { planLimitError } from '@/lib/plans';
import { normalizeBarcode } from '@/lib/sku';
import { costSnapshot, normalizeCost } from '@/lib/currency';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/departments/[id]/stock
 * Adds a product to a department's inventory, if the organization's plan allows another.
 * Body: { name, sku, barcode?, unit, quantity, minStock, unitCost? }
 */
export async function POST(req: Request, { params }: Params) {
    const { session, error } = await requirePermission(PERMISSIONS.EDIT_STOCK);
    if (error) return error;

    try {
        const departmentId = toObjectId((await params).id);
        const department = departmentId && await findOwnDepartment(session, departmentId);
        if (!department) return notFound("departmentNotFound");
        const limitError = await planLimitError(department.clientId, "items");
        if (limitError) return limitError;

        const body = await req.json();
        if (!body.name || !body.sku) return badRequest("nameAndSkuRequired");
        const barcode = normalizeBarcode(body.barcode);
        if (barcode === false) return badRequest("invalidBarcode");
        const unitCost = normalizeCost(body.unitCost);
        if (unitCost === false) return badRequest("invalidCost");
        const db = await getDb();
        const stock = db.collection('department_stock');
        const quantity = Number(body.quantity) || 0;
        const now = new Date();

        if (await stock.findOne({ departmentId: department._id, sku: body.sku, isDeleted: { $ne: true } })) {
            return apiError("duplicateSku", 409);
        }
        if (barcode && await stock.findOne({ departmentId: department._id, barcode, isDeleted: { $ne: true } })) {
            return apiError("duplicateBarcode", 409);
        }

        let result;
        try {
            result = await stock.insertOne({
                departmentId: department._id,
                departmentName: department.name,
                clientId: department.clientId,
                productName: body.name,
                sku: body.sku,
                // Left out when empty: the unique barcode index only covers products that have one
                ...(barcode && { barcode }),
                unit: body.unit,
                quantity,
                minStock: Number(body.minStock),
                ...(unitCost !== null && { unitCost }),
                // Set explicitly: the unique SKU index only covers documents with isDeleted: false
                isDeleted: false,
                updatedAt: now,
                createdAt: now
            });
        } catch (error) {
            // Two saves of the same code at once: the index catches the one the check above missed
            if (isDuplicateKeyError(error, "barcode")) return apiError("duplicateBarcode", 409);
            if (isDuplicateKeyError(error)) return apiError("duplicateSku", 409);
            throw error;
        }

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
                ...costSnapshot(unitCost),
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
