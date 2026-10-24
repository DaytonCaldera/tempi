import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { badRequest, forbidden, getDb, notFound, serverError, toObjectId, unauthorized } from "@/lib/api";
import { findOwnDepartment } from "@/lib/departments";
import { afterStockChange } from "@/lib/stock-alerts";
import { applyMove, canMoveIn } from "@/lib/stock-moves";
import type { MovementType, StockItem } from "@/types/models";

/**
 * PATCH /api/admin/inventory/[id]/move
 * Adds or removes stock and records the change in stock_movements (the audit log reports are built from).
 * Body: { amount: number, type: "IN" | "OUT", reason?: string }
 *
 * - Admins can move stock in any department of their organization.
 * - Users (runners) only in the departments they are assigned to.
 * - Stock can't go below zero.
 * Moves made without connection come through /api/runner/sync instead.
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
        if (!await canMoveIn(session, item.departmentId)) return forbidden("moveNotAllowed");

        const result = await applyMove({ item, department, type, amount: quantity, reason, user: session.user });
        if (!result.ok) return result.error === "productGone" ? notFound("productNotFoundOrDenied") : badRequest("insufficientStock");

        // Emails the admins when this move took it to its minimum (or clears the alert once it's back above)
        await afterStockChange(req, [itemId]);

        return NextResponse.json({ success: true, newQuantity: result.newQuantity });
    } catch (error) {
        console.error("Move stock error:", error);
        return serverError();
    }
}
