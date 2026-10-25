import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/auth";
import mongo from "@/lib/mongodb";
import { apiError, badRequest, forbidden, getDb, isDuplicateKeyError, notFound, serverError, toObjectId, unauthorized } from "@/lib/api";
import { MOVEMENT_REASONS, PERMISSIONS } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";
import { findOwnDepartment, runnerDepartmentIds } from "@/lib/departments";
import { planLimitError } from "@/lib/plans";
import { generateUniqueSKU } from "@/lib/sku";
import { costSnapshot } from "@/lib/currency";
import { afterStockChange } from "@/lib/stock-alerts";
import type { Department, StockItem, TransferPreview } from "@/types/models";

const sameName = (a: string, b: string) => a.trim().localeCompare(b.trim(), undefined, { sensitivity: "accent" }) === 0;

/**
 * The destination's product for `item`: the same barcode, else the same SKU, else the same name (ignoring case).
 * Several matches can't happen for barcode and SKU (unique per department); for names the first one wins.
 */
function findCounterpart(item: StockItem, candidates: StockItem[]) {
    return (item.barcode && candidates.find(c => c.barcode === item.barcode))
        || candidates.find(c => c.sku === item.sku)
        || candidates.find(c => sameName(c.productName, item.productName))
        || null;
}

/**
 * POST /api/admin/inventory/[id]/transfer
 * Moves stock of a product to another department of the organization, in one step.
 * Body: { toDepartmentId, amount, moveAll?: boolean, dryRun?: boolean }
 * - The destination product is the one with the same barcode, SKU or name. Without one it is created there
 *   (same name, unit, category, minimum and codes), if the plan allows another product.
 * - Units must match: kilos never add to boxes.
 * - Both changes, and their two movements (reason "Transferencia entre departamentos", each pointing at the
 *   other department), happen in one transaction: all or nothing.
 * - moveAll moves the whole product: all of its stock (amount is ignored) and the product itself, which is removed
 *   from the source like a delete (soft: its history stays). Works with no stock too, to move an empty product.
 * - Roles that edit stock can transfer between any departments; roles that move stock (runners) only between
 *   departments they work in.
 * dryRun returns the TransferPreview without changing anything. Otherwise: { sourceQuantity, targetQuantity }.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    try {
        const itemId = toObjectId((await params).id);
        const body = await req.json().catch(() => null);
        const toDepartmentId = toObjectId(body?.toDepartmentId);
        const moveAll = body?.moveAll === true;
        const requested = Number(body?.amount);
        const dryRun = body?.dryRun === true;
        if (!itemId || !toDepartmentId || (!moveAll && !(requested > 0 && Number.isFinite(requested)))) return badRequest("missingData");

        const db = await getDb();
        const stock = db.collection<StockItem>("department_stock");
        const item = await stock.findOne({ _id: itemId, isDeleted: { $ne: true } });
        const [source, target] = item
            ? await Promise.all([findOwnDepartment(session, item.departmentId), findOwnDepartment(session, toDepartmentId)])
            : [null, null];
        if (!item || !source) return notFound("productNotFoundOrDenied");
        if (!target) return notFound("departmentNotFoundOrDenied");
        if (source._id.equals(target._id)) return badRequest("transferSameDepartment");

        if (!hasPermission(session, PERMISSIONS.EDIT_STOCK)) {
            const allowed = hasPermission(session, PERMISSIONS.MOVE_STOCK) ? await runnerDepartmentIds(session) : [];
            if (![source._id, target._id].every(id => allowed.some(a => a.equals(id)))) return forbidden("moveNotAllowed");
        }

        const amount = moveAll ? item.quantity : requested;
        const candidates = await stock.find({ departmentId: target._id, isDeleted: { $ne: true } }).toArray();
        const counterpart = findCounterpart(item, candidates);
        if (counterpart && counterpart.unit !== item.unit) return badRequest("transferUnitMismatch");
        if (item.quantity < amount) return badRequest("insufficientStock");
        if (!counterpart) {
            const limitError = await planLimitError(target.clientId, "items");
            if (limitError) return limitError;
        }

        if (dryRun) {
            return NextResponse.json({
                target: counterpart && {
                    _id: counterpart._id.toString(), productName: counterpart.productName, sku: counterpart.sku,
                    quantity: counterpart.quantity, unit: counterpart.unit, minStock: counterpart.minStock,
                },
                targetDepartmentName: target.name,
                newMinStock: item.minStock,
            } satisfies TransferPreview);
        }

        const result = await transfer({ item, source, target, counterpart, candidates, amount, moveAll, user: session.user });
        if ("error" in result) return result.error;

        // Either side can cross its minimum: the source drops, the destination may come back above it
        await afterStockChange(req, [item._id, result.targetId]);
        return NextResponse.json({ sourceQuantity: result.sourceQuantity, targetQuantity: result.targetQuantity });
    } catch (error) {
        console.error("Transfer stock error:", error);
        return serverError();
    }
}

async function transfer({ item, source, target, counterpart, candidates, amount, moveAll, user }: {
    item: StockItem; source: Department; target: Department; counterpart: StockItem | null; candidates: StockItem[];
    amount: number; moveAll: boolean; user: { id?: string; name?: string | null; email?: string | null };
}): Promise<{ sourceQuantity: number; targetQuantity: number; targetId: ObjectId } | { error: Promise<NextResponse> }> {
    const client = await mongo;
    const db = await getDb();
    const stock = db.collection<StockItem>("department_stock");
    const movements = db.collection("stock_movements");
    const now = new Date();
    const transferId = new ObjectId();
    const movementUser = { id: toObjectId(user.id), name: user.name, email: user.email };

    const session = client.startSession();
    try {
        let outcome: { sourceQuantity: number; targetQuantity: number; targetId: ObjectId } | null = null;
        let failure: "insufficientStock" | "conflict" | null = null;
        await session.withTransaction(async () => {
            outcome = null;
            failure = null;
            // The same atomic check as a move: only while there is enough stock. Moving it all needs exactly the
            // quantity that was read (a move in between would leave some behind), and removes it like a delete
            const after = await stock.findOneAndUpdate(
                { _id: item._id, isDeleted: { $ne: true }, quantity: moveAll ? amount : { $gte: amount } },
                {
                    $inc: { quantity: -amount },
                    $set: {
                        updatedAt: now,
                        ...(moveAll && { isDeleted: true, active: false, deletedAt: now, deletedBy: { name: user.name ?? null, email: user.email } }),
                    },
                },
                { returnDocument: "after", session }
            );
            if (!after) {
                // Moving it all fails when the quantity changed since it was read: try again with the new one
                failure = moveAll ? "conflict" : "insufficientStock";
                await session.abortTransaction();
                return;
            }

            let targetId: ObjectId;
            let targetAfter: number;
            let targetSku: string;
            let targetName: string;
            let targetCost: number | undefined;
            if (counterpart && amount === 0) {
                // An empty product moved to one that exists: nothing to add
                targetId = counterpart._id;
                targetAfter = counterpart.quantity;
                targetSku = counterpart.sku;
                targetName = counterpart.productName;
                targetCost = counterpart.unitCost;
            } else if (counterpart) {
                const updated = await stock.findOneAndUpdate(
                    { _id: counterpart._id, isDeleted: { $ne: true } },
                    { $inc: { quantity: amount }, $set: { updatedAt: now } },
                    { returnDocument: "after", session }
                );
                if (!updated) {
                    failure = "conflict";
                    await session.abortTransaction();
                    return;
                }
                targetId = updated._id;
                targetAfter = updated.quantity;
                targetSku = updated.sku;
                targetName = updated.productName;
                targetCost = updated.unitCost;
            } else {
                // Keeps the SKU when the destination doesn't use it, like the barcode (it didn't match any product)
                const taken = new Set(candidates.map(c => c.sku));
                targetSku = taken.has(item.sku) ? generateUniqueSKU(target.name, taken) : item.sku;
                targetName = item.productName;
                const { insertedId } = await stock.insertOne({
                    departmentId: target._id,
                    departmentName: target.name,
                    clientId: target.clientId,
                    productName: item.productName,
                    sku: targetSku,
                    ...(item.barcode && { barcode: item.barcode }),
                    unit: item.unit,
                    ...(item.category && { category: item.category }),
                    quantity: amount,
                    minStock: item.minStock,
                    ...(item.unitCost !== undefined && { unitCost: item.unitCost }),
                    isDeleted: false,
                    createdAt: now,
                    updatedAt: now,
                } as StockItem, { session });
                targetId = insertedId;
                targetAfter = amount;
                targetCost = item.unitCost;
            }

            const base = { clientId: source.clientId, amount, reason: MOVEMENT_REASONS.TRANSFER, user: movementUser, createdAt: now };
            // Moving an empty product changes no quantity: no movements
            if (amount > 0) await movements.insertMany([
                {
                    ...base, inventoryId: item._id, departmentId: source._id, departmentName: source.name,
                    productName: item.productName, sku: item.sku, type: "OUT", ...costSnapshot(item.unitCost),
                    previousBalance: after.quantity + amount, newBalance: after.quantity,
                    transfer: { id: transferId, departmentId: target._id, departmentName: target.name },
                },
                {
                    ...base, inventoryId: targetId, departmentId: target._id, departmentName: target.name,
                    productName: targetName, sku: targetSku, type: "IN", ...costSnapshot(targetCost),
                    previousBalance: targetAfter - amount, newBalance: targetAfter,
                    transfer: { id: transferId, departmentId: source._id, departmentName: source.name },
                },
            ], { session });
            outcome = { sourceQuantity: after.quantity, targetQuantity: targetAfter, targetId };
        });

        if (failure === "insufficientStock") return { error: badRequest("insufficientStock") };
        if (failure === "conflict" || !outcome) return { error: apiError("transferConflict", 409) };
        return outcome;
    } catch (error) {
        // The destination got a product with the same code at the same moment: nothing was changed
        if (isDuplicateKeyError(error)) return { error: apiError("transferConflict", 409) };
        throw error;
    } finally {
        await session.endSession();
    }
}
