import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { PERMISSIONS } from "@/lib/constants";
import { apiError, badRequest, getDb, isDuplicateKeyError, notFound, serverError, toObjectId } from "@/lib/api";
import { findOwnDepartment } from "@/lib/departments";
import { afterStockChange } from "@/lib/stock-alerts";

type Params = { params: Promise<{ id: string; stockId: string }> };

/**
 * PUT /api/admin/departments/[id]/stock/[stockId]
 * Updates a stock item's descriptive fields (name, SKU, unit, minStock).
 * Quantity is NOT changed here: quantity changes go through /api/admin/inventory/[id]/move
 * so they are recorded in stock_movements.
 */
export async function PUT(req: Request, { params }: Params) {
    const { session, error } = await requirePermission(PERMISSIONS.EDIT_STOCK);
    if (error) return error;

    try {
        const { id, stockId } = await params;
        const departmentId = toObjectId(id);
        const itemId = toObjectId(stockId);
        const { name, sku, unit, minStock } = await req.json();

        if (!name || !sku) return badRequest("nameAndSkuRequired");
        if (!departmentId || !itemId) return notFound("productNotFoundOrDenied");

        const db = await getDb();
        const stock = db.collection('department_stock');

        const [item, department] = await Promise.all([
            stock.findOne({ _id: itemId, departmentId }),
            findOwnDepartment(session, departmentId),
        ]);
        if (!item || !department) return notFound("productNotFoundOrDenied");

        // Deleted products don't hold on to their SKU
        const duplicate = await stock.findOne({ _id: { $ne: itemId }, departmentId, sku, isDeleted: { $ne: true } });
        if (duplicate) return apiError("duplicateSku", 409);

        try {
            await stock.updateOne(
                { _id: itemId },
                { $set: { productName: name, sku, unit, minStock, updatedAt: new Date() } }
            );
        } catch (error) {
            if (isDuplicateKeyError(error)) return apiError("duplicateSku", 409);
            throw error;
        }

        // A new minimum can put the product below it, or above it again
        if (Number(minStock) !== item.minStock) await afterStockChange(req, [itemId]);

        const updatedItem = await stock.findOne({ _id: itemId });
        return NextResponse.json({ success: true, item: updatedItem });
    } catch (error) {
        console.error("PUT stock item error:", error);
        return serverError();
    }
}

/**
 * DELETE /api/admin/departments/[id]/stock/[stockId]
 * Soft delete: marks the item as deleted but keeps the document, so its
 * stock_movements history stays valid for reports.
 */
export async function DELETE(req: Request, { params }: Params) {
    const { session, error } = await requirePermission(PERMISSIONS.EDIT_STOCK);
    if (error) return error;

    try {
        const { id, stockId } = await params;
        const departmentId = toObjectId(id);
        const itemId = toObjectId(stockId);
        if (!departmentId || !itemId) return notFound("productNotFoundOrDenied");

        const db = await getDb();
        const stock = db.collection('department_stock');

        const [item, department] = await Promise.all([
            stock.findOne({ _id: itemId, departmentId }),
            findOwnDepartment(session, departmentId),
        ]);
        if (!item || !department) return notFound("productNotFoundOrDenied");

        await stock.updateOne(
            { _id: itemId },
            {
                $set: {
                    isDeleted: true,
                    active: false,
                    deletedAt: new Date(),
                    deletedBy: { name: session.user.name ?? null, email: session.user.email },
                    updatedAt: new Date()
                }
            }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE stock item error:", error);
        return serverError();
    }
}
