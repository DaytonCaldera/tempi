import { ObjectId } from "mongodb";
import { getDb } from "@/lib/api";
import { MOVEMENT_REASONS } from "@/lib/constants";
import type { Department, StockItem, StockMovement } from "@/types/models";

/**
 * Server only: finds and repairs stock items whose movement history doesn't explain their quantity.
 * Same rules as scripts/repair-stock-movements.js (keep them in sync), used by the superadmin panel:
 *   - "Sincronización inicial del sistema" movements (old /api/admin/reports/sync) never changed the quantity:
 *     they are moved to "stock_movements_archive" (not deleted, so a repair can be undone).
 *   - An item created with a quantity but no movement gets an "Inventario inicial" IN.
 *   - A gap in the chain (previousBalance not matching the history so far, or a quantity that doesn't match
 *     the last movement) gets a "Conciliación de inventario" movement for the difference, dated inside the gap.
 * The consumption report works backwards from the current quantity, so these make every past date add up.
 */

type Movement = Pick<StockMovement, "_id" | "type" | "amount" | "previousBalance" | "createdAt" | "reason">;

export type MissingMovement = {
    type: "IN" | "OUT";
    amount: number;
    previousBalance: number;
    newBalance: number;
    reason: string;
    createdAt: Date;
};

export type ItemRepair = {
    itemId: string;
    productName: string;
    sku: string;
    departmentName: string;
    clientId: string;
    quantity: number;
    /** Old sync movements to archive */
    syncMovements: number;
    missing: MissingMovement[];
};

const signedAmount = (m: Movement) => (m.type === "IN" ? 1 : -1) * (Number(m.amount) || 0);
const addMs = (date: Date, ms: number) => new Date(date.getTime() + ms);

/**
 * Walks an item's movements (oldest first, sync movements left out) and returns the movements missing
 * from its history. `running` is the quantity the history explains so far, starting at 0.
 */
export function findMissingMovements(item: Pick<StockItem, "_id" | "quantity" | "createdAt">, movements: Movement[]): MissingMovement[] {
    const createdAt = item.createdAt ? new Date(item.createdAt) : item._id.getTimestamp();
    const firstDate = movements.length > 0 ? new Date(movements[0].createdAt) : null;
    const openingDate = !firstDate || createdAt < firstDate ? createdAt : addMs(firstDate, -1);
    const missing: MissingMovement[] = [];
    let running = 0;
    // Older movements have no previousBalance. Until the first balance is known, any difference is
    // stock the item started with; after that, it's a change that was never logged.
    let anchored = false;

    const addGap = (actual: number, gapDate: Date) => {
        const difference = actual - running;
        if (difference !== 0) {
            const opening = !anchored;
            missing.push({
                type: difference > 0 ? "IN" : "OUT",
                amount: Math.abs(difference),
                // Opening stock goes before every movement: previousBalance 0
                previousBalance: opening ? 0 : running,
                newBalance: opening ? difference : actual,
                reason: opening ? MOVEMENT_REASONS.INITIAL_STOCK : MOVEMENT_REASONS.RECONCILIATION,
                createdAt: opening ? openingDate : gapDate,
            });
        }
        running = actual;
        anchored = true;
    };

    movements.forEach((movement, index) => {
        if (typeof movement.previousBalance === "number") {
            // Somewhere between the previous movement and this one
            const date = new Date(movement.createdAt);
            const previousDate = index > 0 ? new Date(movements[index - 1].createdAt) : openingDate;
            addGap(movement.previousBalance, addMs(date, -1) > previousDate ? addMs(date, -1) : previousDate);
        }
        running += signedAmount(movement);
    });

    // The current quantity must match the end of the history
    const lastDate = movements.length > 0 ? addMs(new Date(movements[movements.length - 1].createdAt), 1) : createdAt;
    addGap(Number(item.quantity) || 0, lastDate);

    return missing;
}

/**
 * What a repair would change: the items (of one organization, or all) that need it.
 * Deleted items are included, because the reports still show their history.
 */
export async function planStockRepair(clientId?: ObjectId): Promise<ItemRepair[]> {
    const db = await getDb();
    const departments = await db.collection<Department>("departments")
        .find(clientId ? { clientId } : {}, { projection: { name: 1, clientId: 1 } }).toArray();
    if (departments.length === 0) return [];
    const departmentById = new Map(departments.map(d => [d._id.toString(), d]));

    const items = await db.collection<StockItem>("department_stock")
        .find({ departmentId: { $in: departments.map(d => d._id) } }, { projection: { productName: 1, sku: 1, quantity: 1, createdAt: 1, departmentId: 1, departmentName: 1 } })
        .toArray();
    if (items.length === 0) return [];

    // One read for every movement of these items, grouped in memory
    const movements = await db.collection<StockMovement>("stock_movements")
        .find({ inventoryId: { $in: items.map(i => i._id) } }, { projection: { inventoryId: 1, type: 1, amount: 1, previousBalance: 1, createdAt: 1, reason: 1 } })
        .sort({ createdAt: 1, _id: 1 })
        .toArray();
    const byItem = new Map<string, StockMovement[]>();
    for (const m of movements) {
        const key = m.inventoryId.toString();
        if (!byItem.has(key)) byItem.set(key, []);
        byItem.get(key)!.push(m);
    }

    const repairs: ItemRepair[] = [];
    for (const item of items) {
        const history = byItem.get(item._id.toString()) ?? [];
        const syncMovements = history.filter(m => m.reason === MOVEMENT_REASONS.INITIAL_SYNC).length;
        const missing = findMissingMovements(item, history.filter(m => m.reason !== MOVEMENT_REASONS.INITIAL_SYNC));
        if (syncMovements === 0 && missing.length === 0) continue;
        repairs.push({
            itemId: item._id.toString(),
            productName: item.productName,
            sku: item.sku,
            departmentName: departmentById.get(item.departmentId.toString())?.name ?? item.departmentName ?? "",
            clientId: departmentById.get(item.departmentId.toString())?.clientId.toString() ?? "",
            quantity: Number(item.quantity) || 0,
            syncMovements,
            missing,
        });
    }
    return repairs;
}

/**
 * Applies a fresh plan for one organization (never one sent by the browser): archives the sync movements
 * and inserts the missing ones. Returns how many of each, for the audit log.
 */
export async function applyStockRepair(clientId: ObjectId, actor: { email?: string | null }) {
    const db = await getDb();
    const repairs = await planStockRepair(clientId);
    if (repairs.length === 0) return { items: 0, archived: 0, inserted: 0 };

    const items = await db.collection<StockItem>("department_stock")
        .find({ _id: { $in: repairs.map(r => new ObjectId(r.itemId)) } })
        .toArray();
    const itemById = new Map(items.map(i => [i._id.toString(), i]));
    const departmentNames = new Map(repairs.map(r => [r.itemId, r.departmentName]));

    // 1. Archive the sync movements: copied with who and when, then removed from the live collection
    const movements = db.collection<StockMovement>("stock_movements");
    const syncMovements = await movements.find({ inventoryId: { $in: items.map(i => i._id) }, reason: MOVEMENT_REASONS.INITIAL_SYNC }).toArray();
    if (syncMovements.length > 0) {
        const archivedAt = new Date();
        await db.collection("stock_movements_archive").insertMany(syncMovements.map(m => ({ ...m, archivedAt, archivedBy: actor.email ?? null })));
        await movements.deleteMany({ _id: { $in: syncMovements.map(m => m._id) } });
    }

    // 2. Insert what is missing, shaped like the movements the app writes
    const inserts = repairs.flatMap(repair => {
        const item = itemById.get(repair.itemId);
        if (!item) return [];
        return repair.missing.map(m => ({
            inventoryId: item._id,
            departmentId: item.departmentId,
            departmentName: departmentNames.get(repair.itemId) ?? item.departmentName,
            clientId,
            productName: item.productName,
            sku: item.sku,
            ...m,
            user: { id: null, name: null },
        }));
    });
    if (inserts.length > 0) await db.collection("stock_movements").insertMany(inserts);

    return { items: repairs.length, archived: syncMovements.length, inserted: inserts.length };
}
