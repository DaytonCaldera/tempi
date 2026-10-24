import type { Session } from "next-auth";
import type { ObjectId } from "mongodb";
import { getDb, isDuplicateKeyError, toObjectId } from "@/lib/api";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/constants";
import { findOwnDepartment } from "@/lib/departments";
import {
    DUPLICATE_WINDOW_MS, effectiveOccurredAt, HOLD_ESCALATE_MS, screenQueuedMove,
    type HoldReason, type QueuedMove, type SyncResult,
} from "@/lib/offline-sync";
import { hasPermission } from "@/lib/permissions";
import { applyMove, canMoveIn } from "@/lib/stock-moves";
import { getTenantQuery } from "@/lib/tenant-guard";
import type { Department, HeldMovement, StockItem, StockMovement } from "@/types/models";

/**
 * Server only: applying the runner's offline queue (POST /api/runner/sync) and deciding held moves
 * (/api/runner/held). The rules are in lib/offline-sync.ts.
 */

/** Applies or holds each queued move, oldest first. Returns what happened to each, and the products that changed. */
export async function syncQueuedMoves(session: Session, moves: QueuedMove[]): Promise<{ results: SyncResult[]; changed: ObjectId[] }> {
    const db = await getDb();
    const stock = db.collection<StockItem>("department_stock");
    const movements = db.collection<StockMovement>("stock_movements");
    const held = db.collection<HeldMovement>("held_movements");
    const now = new Date();
    const user = { id: session.user.id ?? null, name: session.user.name ?? null, email: session.user.email ?? null };
    const results: SyncResult[] = [];
    const changed: ObjectId[] = [];
    const departments = new Map<string, Department | null>();

    for (const move of [...moves].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))) {
        const { offlineId } = move;

        // Sent before (the device didn't get the answer, or retried): report what happened then, apply nothing
        const applied = await movements.findOne({ offlineId }, { projection: { inventoryId: 1 } });
        if (applied) {
            const item = await stock.findOne({ _id: applied.inventoryId }, { projection: { quantity: 1 } });
            results.push({ offlineId, status: "applied", newQuantity: item?.quantity ?? 0 });
            continue;
        }
        const previous = await held.findOne({ offlineId }, { projection: { holdReason: 1 } });
        if (previous) {
            results.push({ offlineId, status: "held", holdReason: previous.holdReason });
            continue;
        }

        // A product of the organization (deleted ones too: they are held as productGone)
        const inventoryId = toObjectId(move.inventoryId);
        const item = inventoryId && await stock.findOne({ _id: inventoryId });
        const departmentKey = item?.departmentId.toString() ?? "";
        if (item && !departments.has(departmentKey)) departments.set(departmentKey, await findOwnDepartment(session, item.departmentId));
        const department = item ? departments.get(departmentKey) : null;
        if (!item || !department) {
            results.push({ offlineId, status: "invalid" });
            continue;
        }

        const occurredAt = effectiveOccurredAt(move, now);
        const similar = await movements.find(
            { inventoryId: item._id, createdAt: { $gte: occurredAt, $lte: new Date(occurredAt.getTime() + DUPLICATE_WINDOW_MS) } },
            { projection: { "user.email": 1, "user.name": 1, type: 1, amount: 1, createdAt: 1 } }
        ).toArray();
        const screen = screenQueuedMove(move, {
            now,
            userEmail: user.email,
            productExists: !item.isDeleted,
            allowed: await canMoveIn(session, item.departmentId),
            similar: similar.map(m => ({ userEmail: m.user?.email ?? null, type: m.type, amount: m.amount, createdAt: m.createdAt })),
        });

        let holdReason: HoldReason | null = screen?.holdReason ?? null;
        if (!holdReason) {
            const result = await applyMove({ item, department, type: move.type, amount: move.amount, reason: move.reason, user, offline: { offlineId, occurredAt } });
            if (result.ok) {
                results.push({ offlineId, status: "applied", newQuantity: result.newQuantity });
                changed.push(item._id);
                continue;
            }
            if (result.error === "alreadyApplied") {
                // Another request with the same queue got there first
                const current = await stock.findOne({ _id: item._id }, { projection: { quantity: 1 } });
                results.push({ offlineId, status: "applied", newQuantity: current?.quantity ?? 0 });
                continue;
            }
            holdReason = result.error;
        }

        const duplicate = screen?.duplicateOf && similar.find(m => m.createdAt.getTime() === screen.duplicateOf!.createdAt.getTime());
        try {
            await held.insertOne({
                offlineId,
                clientId: department.clientId,
                departmentId: department._id,
                departmentName: department.name,
                inventoryId: item._id,
                productName: item.productName,
                sku: item.sku,
                unit: item.unit,
                type: move.type,
                amount: move.amount,
                reason: move.reason,
                holdReason,
                ...(duplicate && { duplicateOf: { userName: duplicate.user?.name ?? null, userEmail: duplicate.user?.email ?? null, amount: duplicate.amount, createdAt: duplicate.createdAt } }),
                occurredAt,
                heldAt: now,
                user: { id: toObjectId(user.id), name: user.name, email: user.email },
                status: "pending",
            } as HeldMovement);
        } catch (error) {
            // Held by another request with the same queue
            if (!isDuplicateKeyError(error)) throw error;
        }
        results.push({ offlineId, status: "held", holdReason });
    }
    return { results, changed };
}

/** A held move as the runner and the admins see it. */
export type HeldView = Omit<HeldMovement<string>, "occurredAt" | "heldAt" | "resolvedAt" | "duplicateOf"> & {
    occurredAt: string;
    heldAt: string;
    duplicateOf?: { userName: string | null; amount: number; createdAt: string };
    /** Waiting longer than HOLD_ESCALATE_MS: admins can decide it too */
    escalated: boolean;
    /** Made by the viewer */
    mine: boolean;
};

/**
 * The pending held moves the user can decide: their own, and, for admins of stock, the organization's that waited
 * HOLD_ESCALATE_MS for their runner. Oldest first.
 */
export async function listHeld(session: Session): Promise<HeldView[]> {
    const db = await getDb();
    const now = Date.now();
    const email = session.user.email ?? "";
    const isAdmin = hasPermission(session, PERMISSIONS.EDIT_STOCK);
    const tenant = getTenantQuery(session);
    const docs = await db.collection<HeldMovement>("held_movements").find({
        ...tenant,
        status: "pending",
        $or: [
            { "user.email": email },
            ...(isAdmin ? [{ heldAt: { $lte: new Date(now - HOLD_ESCALATE_MS) } }] : []),
        ],
    }).sort({ occurredAt: 1 }).limit(200).toArray();

    return docs.map(doc => ({
        ...doc,
        _id: doc._id.toString(),
        clientId: doc.clientId.toString(),
        departmentId: doc.departmentId.toString(),
        inventoryId: doc.inventoryId.toString(),
        user: { name: doc.user?.name ?? null, email: doc.user?.email ?? null },
        occurredAt: doc.occurredAt.toISOString(),
        heldAt: doc.heldAt.toISOString(),
        duplicateOf: doc.duplicateOf && { userName: doc.duplicateOf.userName, amount: doc.duplicateOf.amount, createdAt: doc.duplicateOf.createdAt.toISOString() },
        escalated: now - doc.heldAt.getTime() >= HOLD_ESCALATE_MS,
        mine: doc.user?.email?.toLowerCase() === email.toLowerCase(),
        resolvedAt: undefined,
        resolvedBy: undefined,
    }));
}

export type ResolveError = "heldNotFound" | "heldNotYours" | "insufficientStock" | "productGone";

/**
 * Applies or discards a held move. Its runner can always; an admin of stock once it waited HOLD_ESCALATE_MS.
 * Applying runs the move now (with the stock there is now) keeping its offline id, so it can't apply twice; when it
 * still can't apply (stock short, product gone) it stays pending and the error says why.
 */
export async function resolveHeld(session: Session, heldId: ObjectId, decision: "apply" | "discard"): Promise<{ ok: true; changed?: ObjectId } | { ok: false; error: ResolveError }> {
    const db = await getDb();
    const held = db.collection<HeldMovement>("held_movements");
    const doc = await held.findOne({ _id: heldId, status: "pending", ...getTenantQuery(session) });
    if (!doc) return { ok: false, error: "heldNotFound" };

    const mine = doc.user?.email?.toLowerCase() === session.user.email?.toLowerCase();
    const escalated = Date.now() - doc.heldAt.getTime() >= HOLD_ESCALATE_MS;
    if (!mine && !(escalated && hasPermission(session, PERMISSIONS.EDIT_STOCK))) return { ok: false, error: "heldNotYours" };

    // Claimed first, so two people deciding at once can't both count (one applies, the other discards)
    const resolvedBy = { name: session.user.name ?? null, email: session.user.email ?? null };
    const status = decision === "apply" ? "applied" : "discarded";
    const claimed = await held.updateOne({ _id: heldId, status: "pending" }, { $set: { status, resolvedAt: new Date(), resolvedBy } });
    if (claimed.modifiedCount === 0) return { ok: false, error: "heldNotFound" };

    let changed: ObjectId | undefined;
    if (decision === "apply") {
        const release = () => held.updateOne({ _id: heldId }, { $set: { status: "pending" }, $unset: { resolvedAt: "", resolvedBy: "" } });
        const item = await db.collection<StockItem>("department_stock").findOne({ _id: doc.inventoryId, isDeleted: { $ne: true } });
        const department = item && await findOwnDepartment(session, item.departmentId);
        if (!item || !department) {
            await release();
            return { ok: false, error: "productGone" };
        }
        // The move is the runner's: recorded with their name and the time it happened
        const result = await applyMove({
            item, department, type: doc.type, amount: doc.amount, reason: doc.reason,
            user: doc.user, offline: { offlineId: doc.offlineId, occurredAt: doc.occurredAt },
        });
        if (!result.ok && result.error !== "alreadyApplied") {
            // Still can't apply (e.g. stock short): it stays pending for another decision
            await release();
            return { ok: false, error: result.error };
        }
        changed = item._id;
    }

    await logAudit(AUDIT_ACTIONS.RESOLVE_HELD, {
        actor: session.user,
        clientId: doc.clientId,
        details: {
            decision, holdReason: doc.holdReason, product: doc.productName, department: doc.departmentName,
            type: doc.type, amount: doc.amount, runner: doc.user?.email ?? null, occurredAt: doc.occurredAt.toISOString(),
        },
    });
    return { ok: true, changed };
}
