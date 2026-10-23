import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { badRequest, forbidden, getDb, notFound, serverError, toObjectId, unauthorized } from "@/lib/api";
import { MOVEMENT_REASONS, ROLES } from "@/lib/constants";
import { assignedDepartmentIds, findOwnDepartment } from "@/lib/departments";
import type { MovementType, StockItem } from "@/types/models";

const MANAGEMENT_ROLES = [ROLES.ADMIN, ROLES.SUPERADMIN];

/**
 * PATCH /api/admin/inventory/[id]/move
 * Adds or removes stock and records the change in stock_movements (the audit log reports are built from).
 * Body: { amount: number, type: "IN" | "OUT", reason?: string }
 *
 * - Admins can move stock in any department of their organization.
 * - Users (runners) only in the departments they are assigned to.
 * - Stock can't go below zero.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    try {
        const itemId = toObjectId((await params).id);
        const { amount, type, reason } = await req.json() as { amount: number; type: MovementType; reason?: string };

        const quantity = Math.abs(Number(amount));
        if (!itemId || !quantity || (type !== "IN" && type !== "OUT")) return badRequest("missingData");

        const db = await getDb();
        const item = await db.collection<StockItem>('department_stock').findOne({ _id: itemId, isDeleted: { $ne: true } });
        const department = item && await findOwnDepartment(session, item.departmentId);
        if (!item || !department) return notFound("productNotFoundOrDenied");

        // The session's role and departments are resolved from the user's document (see the jwt callback in auth.ts)
        const role = session.user.role;
        const isManagement = MANAGEMENT_ROLES.includes(role);
        const isAssignedUser = role === ROLES.USER &&
            assignedDepartmentIds(session).some(id => id.equals(item.departmentId));

        if (!isManagement && !isAssignedUser) {
            return forbidden("moveNotAllowed");
        }

        // Atomic $inc: concurrent moves can't overwrite each other, and an OUT only matches while there is enough stock
        const delta = type === "IN" ? quantity : -quantity;
        const stock = db.collection<StockItem>('department_stock');
        const updated = await stock.findOneAndUpdate(
            { _id: itemId, isDeleted: { $ne: true }, ...(type === "OUT" && { quantity: { $gte: quantity } }) },
            { $inc: { quantity: delta }, $set: { updatedAt: new Date() } },
            { returnDocument: "after" }
        );
        if (!updated) return badRequest("insufficientStock");

        const newBalance = updated.quantity;
        const previousBalance = newBalance - delta;

        try {
            await db.collection('stock_movements').insertOne({
                inventoryId: itemId,
                departmentId: item.departmentId,
                departmentName: department.name,
                clientId: department.clientId,
                productName: item.productName,
                sku: item.sku,
                type,
                amount: quantity,
                previousBalance,
                newBalance,
                reason: reason || MOVEMENT_REASONS.MANUAL_ADJUSTMENT,
                user: { id: toObjectId(session.user.id), name: session.user.name, email: session.user.email },
                createdAt: new Date()
            });
        } catch (error) {
            // Without its movement the change would break the reports: undo it
            await stock.updateOne({ _id: itemId }, { $inc: { quantity: -delta } });
            throw error;
        }

        return NextResponse.json({ success: true, newQuantity: newBalance });
    } catch (error) {
        console.error("Move stock error:", error);
        return serverError();
    }
}
