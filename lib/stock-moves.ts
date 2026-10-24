import type { Session } from "next-auth";
import type { ObjectId } from "mongodb";
import { getDb, isDuplicateKeyError, toObjectId } from "@/lib/api";
import { MOVEMENT_REASONS, ROLES } from "@/lib/constants";
import { costSnapshot } from "@/lib/currency";
import { runnerDepartmentIds } from "@/lib/departments";
import type { Department, MovementType, StockItem } from "@/types/models";

/**
 * Server only: one stock move (IN or OUT) and its movement, the same for a move made online
 * (app/api/admin/inventory/[id]/move), one synced from the runner's offline queue (lib/offline-sync-server.ts)
 * and a held one an admin or the runner applies later.
 */

const MANAGEMENT_ROLES = [ROLES.ADMIN];

/** Whether the user may move stock of `departmentId`: admins anywhere, runners in the departments they work in. */
export async function canMoveIn(session: Session, departmentId: ObjectId) {
    // The session's role and departments are resolved from the user's document (see the jwt callback in auth.ts)
    const role = session.user.role;
    if (MANAGEMENT_ROLES.includes(role)) return true;
    return role === ROLES.USER && (await runnerDepartmentIds(session)).some(id => id.equals(departmentId));
}

export type MoveUser = { id?: string | ObjectId | null; name?: string | null; email?: string | null };

export type MoveResult =
    | { ok: true; newQuantity: number }
    | { ok: false; error: "insufficientStock" | "productGone" | "alreadyApplied" };

/**
 * Adds or removes `amount` of the product and records the movement. Stock can't go below zero.
 * `offline` marks a move made without connection: when it really happened, and the id the device gave it, which
 * a unique index keeps from being applied twice (alreadyApplied).
 */
export async function applyMove({ item, department, type, amount, reason, user, offline }: {
    item: StockItem;
    department: Department;
    type: MovementType;
    amount: number;
    reason?: string;
    user: MoveUser;
    offline?: { offlineId: string; occurredAt: Date };
}): Promise<MoveResult> {
    const db = await getDb();
    const stock = db.collection<StockItem>("department_stock");

    // Atomic $inc: concurrent moves can't overwrite each other, and an OUT only matches while there is enough stock
    const delta = type === "IN" ? amount : -amount;
    const updated = await stock.findOneAndUpdate(
        { _id: item._id, isDeleted: { $ne: true }, ...(type === "OUT" && { quantity: { $gte: amount } }) },
        { $inc: { quantity: delta }, $set: { updatedAt: new Date() } },
        { returnDocument: "after" }
    );
    if (!updated) {
        const exists = await stock.countDocuments({ _id: item._id, isDeleted: { $ne: true } });
        return { ok: false, error: exists ? "insufficientStock" : "productGone" };
    }

    const newBalance = updated.quantity;
    try {
        await db.collection("stock_movements").insertOne({
            inventoryId: item._id,
            departmentId: item.departmentId,
            departmentName: department.name,
            clientId: department.clientId,
            productName: item.productName,
            sku: item.sku,
            type,
            amount,
            previousBalance: newBalance - delta,
            newBalance,
            reason: reason || MOVEMENT_REASONS.MANUAL_ADJUSTMENT,
            ...costSnapshot(updated.unitCost),
            user: { id: toObjectId(user.id), name: user.name ?? null, email: user.email ?? null },
            // createdAt is when it reached the server: the balance chain (previousBalance -> newBalance) follows it
            createdAt: new Date(),
            ...(offline && { offlineId: offline.offlineId, occurredAt: offline.occurredAt }),
        });
    } catch (error) {
        // Without its movement the change would break the reports: undo it
        await stock.updateOne({ _id: item._id }, { $inc: { quantity: -delta } });
        if (offline && isDuplicateKeyError(error, "offlineId")) return { ok: false, error: "alreadyApplied" };
        throw error;
    }
    return { ok: true, newQuantity: newBalance };
}
