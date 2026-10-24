import type { MovementType } from "@/types/models";

/**
 * The rules for moves the runner makes without connection. Pure, shared by the runner (browser) and the server
 * (lib/offline-sync-server.ts), and covered by lib/offline-sync.test.ts.
 *
 * A queued move reaches the server later. Before applying it, the server checks it against what happened in the
 * meantime; when something doesn't add up it is held (held_movements) for a person to decide instead of applied:
 * - tooOld: made more than OFFLINE_MAX_AGE_MS ago (the stock has surely changed since).
 * - possibleDuplicate: someone else recorded the same product, type and amount within DUPLICATE_WINDOW_MS after it
 *   (e.g. the runner asked a connected colleague to record it too).
 * - insufficientStock: an OUT that is more than what is left now.
 * - productGone: the product was deleted or moved to another department meanwhile.
 * - notAllowed: the runner no longer works in that department.
 * The runner who made it decides first; after HOLD_ESCALATE_MS without an answer the admins see it too.
 */

/** Oldest a queued move can be and still apply by itself. */
export const OFFLINE_MAX_AGE_MS = 6 * 60 * 60_000;

/** How long after a queued move another person's identical move counts as a possible duplicate. */
export const DUPLICATE_WINDOW_MS = 15 * 60_000;

/** How long a held move waits for the runner before the admins see it. */
export const HOLD_ESCALATE_MS = 30 * 60_000;

/** A device clock this far ahead of the server is still believed (small drifts); beyond it, it is wrong. */
export const CLOCK_TOLERANCE_MS = 2 * 60_000;

/** Moves a device sends at once. */
export const MAX_SYNC_BATCH = 200;

export type HoldReason = "tooOld" | "possibleDuplicate" | "insufficientStock" | "productGone" | "notAllowed";

/** A move made without connection, as the device queues and sends it. */
export type QueuedMove = {
    /** Given by the device (crypto.randomUUID): the server applies each id once */
    offlineId: string;
    inventoryId: string;
    type: MovementType;
    amount: number;
    reason: string;
    /** When it was made, by the device's clock (ISO) */
    occurredAt: string;
};

/** What the server did with a queued move. */
export type SyncResult =
    | { offlineId: string; status: "applied"; newQuantity: number }
    | { offlineId: string; status: "held"; holdReason: HoldReason }
    | { offlineId: string; status: "invalid" };

const OFFLINE_ID = /^[A-Za-z0-9-]{8,64}$/;

/** The queued moves of a sync request, the ones that are well formed; null when the body isn't a list of moves. */
export function parseQueuedMoves(body: unknown): QueuedMove[] | null {
    const moves = (body as { moves?: unknown } | null)?.moves;
    if (!Array.isArray(moves) || moves.length > MAX_SYNC_BATCH) return null;
    return moves.filter((m): m is QueuedMove =>
        !!m && typeof m === "object"
        && typeof m.offlineId === "string" && OFFLINE_ID.test(m.offlineId)
        && typeof m.inventoryId === "string"
        && (m.type === "IN" || m.type === "OUT")
        && typeof m.amount === "number" && Number.isFinite(m.amount) && m.amount > 0
        && typeof m.reason === "string" && m.reason.length <= 100
        && typeof m.occurredAt === "string" && !Number.isNaN(Date.parse(m.occurredAt))
    );
}

/**
 * When a queued move happened, as the server records it: the device's time, unless the device's clock is ahead of
 * the server's (beyond CLOCK_TOLERANCE_MS), which can't be: then the time it arrived.
 */
export function effectiveOccurredAt(move: Pick<QueuedMove, "occurredAt">, now: Date) {
    const at = new Date(move.occurredAt);
    return at.getTime() > now.getTime() + CLOCK_TOLERANCE_MS ? now : at;
}

/** Another person's movement that may be the same as a queued one. */
export type SimilarMovement = { userEmail: string | null; type: MovementType; amount: number; createdAt: Date };

/**
 * Whether a queued move must be held before trying to apply it, and why; null when it can be applied (an OUT can
 * still be held after, when the stock is short at that moment).
 * `similar` are the product's movements made after the queued one by anyone (the function picks the ones that count).
 */
export function screenQueuedMove(move: QueuedMove, { now, userEmail, productExists, allowed, similar }: {
    now: Date;
    userEmail: string | null;
    productExists: boolean;
    allowed: boolean;
    similar: SimilarMovement[];
}): { holdReason: HoldReason; duplicateOf?: SimilarMovement } | null {
    if (!productExists) return { holdReason: "productGone" };
    if (!allowed) return { holdReason: "notAllowed" };

    const occurredAt = effectiveOccurredAt(move, now);
    if (now.getTime() - occurredAt.getTime() > OFFLINE_MAX_AGE_MS) return { holdReason: "tooOld" };

    const windowEnd = occurredAt.getTime() + DUPLICATE_WINDOW_MS;
    const duplicateOf = similar.find(m =>
        m.type === move.type
        && m.amount === move.amount
        && m.userEmail?.toLowerCase() !== userEmail?.toLowerCase()
        && m.createdAt.getTime() >= occurredAt.getTime()
        && m.createdAt.getTime() <= windowEnd
    );
    if (duplicateOf) return { holdReason: "possibleDuplicate", duplicateOf };
    return null;
}

/** Whether a held move waiting this long is the admins' to decide too (the runner didn't answer). */
export const isEscalated = (heldAt: Date, now: Date) => now.getTime() - heldAt.getTime() >= HOLD_ESCALATE_MS;
