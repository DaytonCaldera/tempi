import { describe, expect, it } from "vitest";
import {
    CLOCK_TOLERANCE_MS, DUPLICATE_WINDOW_MS, effectiveOccurredAt, HOLD_ESCALATE_MS, isEscalated, MAX_SYNC_BATCH,
    OFFLINE_MAX_AGE_MS, parseQueuedMoves, screenQueuedMove, type QueuedMove, type SimilarMovement,
} from "@/lib/offline-sync";

const now = new Date("2026-10-24T18:00:00.000Z");
const minutes = (n: number) => n * 60_000;
const at = (offsetMs: number) => new Date(now.getTime() + offsetMs);

const move = (overrides: Partial<QueuedMove> = {}): QueuedMove => ({
    offlineId: "b7c1e2f0-1111-4a2b-9c3d-000000000001",
    inventoryId: "6adce0716f871aa33e2b19ce",
    type: "OUT",
    amount: 2,
    reason: "Consumo Runner",
    occurredAt: at(-minutes(30)).toISOString(),
    ...overrides,
});

const context = (overrides: Partial<Parameters<typeof screenQueuedMove>[1]> = {}) => ({
    now, userEmail: "ana@x.co", productExists: true, allowed: true, similar: [] as SimilarMovement[], ...overrides,
});

describe("parseQueuedMoves", () => {
    it("keeps the well formed moves", () => {
        const good = move();
        const moves = parseQueuedMoves({
            moves: [good, { ...good, amount: -1 }, { ...good, type: "TRANSFER" }, { ...good, offlineId: "x" }, { ...good, occurredAt: "ayer" }, null],
        });
        expect(moves).toEqual([good]);
    });

    it("rejects bodies that aren't a list, or too long", () => {
        expect(parseQueuedMoves(null)).toBe(null);
        expect(parseQueuedMoves({ moves: "x" })).toBe(null);
        expect(parseQueuedMoves({ moves: Array.from({ length: MAX_SYNC_BATCH + 1 }, () => move()) })).toBe(null);
    });
});

describe("effectiveOccurredAt", () => {
    it("believes the device's clock, a little ahead included", () => {
        expect(effectiveOccurredAt(move(), now)).toEqual(at(-minutes(30)));
        expect(effectiveOccurredAt(move({ occurredAt: at(CLOCK_TOLERANCE_MS).toISOString() }), now)).toEqual(at(CLOCK_TOLERANCE_MS));
    });

    it("uses the arrival time when the device's clock is in the future", () => {
        expect(effectiveOccurredAt(move({ occurredAt: at(minutes(45)).toISOString() }), now)).toEqual(now);
    });
});

describe("screenQueuedMove", () => {
    it("lets a normal move through", () => {
        expect(screenQueuedMove(move(), context())).toBe(null);
    });

    it("holds moves of products that are gone, or departments the runner left", () => {
        expect(screenQueuedMove(move(), context({ productExists: false }))?.holdReason).toBe("productGone");
        expect(screenQueuedMove(move(), context({ allowed: false }))?.holdReason).toBe("notAllowed");
    });

    it("holds moves older than the maximum age", () => {
        expect(screenQueuedMove(move({ occurredAt: at(-OFFLINE_MAX_AGE_MS - 1000).toISOString() }), context())?.holdReason).toBe("tooOld");
        expect(screenQueuedMove(move({ occurredAt: at(-OFFLINE_MAX_AGE_MS + 1000).toISOString() }), context())).toBe(null);
    });

    describe("possible duplicates", () => {
        // The queued move happened 30 minutes ago
        const colleague = (offset: number, overrides: Partial<SimilarMovement> = {}): SimilarMovement => ({
            userEmail: "juan@x.co", type: "OUT", amount: 2, createdAt: at(-minutes(30) + offset), ...overrides,
        });

        it("holds it when a colleague recorded the same within the window after it", () => {
            const similar = [colleague(minutes(3))];
            const result = screenQueuedMove(move(), context({ similar }));
            expect(result?.holdReason).toBe("possibleDuplicate");
            expect(result?.duplicateOf).toBe(similar[0]);
            expect(screenQueuedMove(move(), context({ similar: [colleague(DUPLICATE_WINDOW_MS)] }))?.holdReason).toBe("possibleDuplicate");
        });

        it("ignores movements outside the window", () => {
            expect(screenQueuedMove(move(), context({ similar: [colleague(DUPLICATE_WINDOW_MS + 1000)] }))).toBe(null);
            // Before the queued move happened: it can't be a copy of it
            expect(screenQueuedMove(move(), context({ similar: [colleague(-minutes(1))] }))).toBe(null);
        });

        it("ignores movements that differ", () => {
            expect(screenQueuedMove(move(), context({ similar: [colleague(minutes(3), { amount: 3 })] }))).toBe(null);
            expect(screenQueuedMove(move(), context({ similar: [colleague(minutes(3), { type: "IN" })] }))).toBe(null);
        });

        it("ignores the runner's own movements (two real moves of theirs)", () => {
            expect(screenQueuedMove(move(), context({ similar: [colleague(minutes(3), { userEmail: "ANA@x.co" })] }))).toBe(null);
        });

        it("checks age before duplicates", () => {
            const old = move({ occurredAt: at(-OFFLINE_MAX_AGE_MS - minutes(5)).toISOString() });
            const similar = [{ userEmail: "juan@x.co", type: "OUT" as const, amount: 2, createdAt: at(-OFFLINE_MAX_AGE_MS) }];
            expect(screenQueuedMove(old, context({ similar }))?.holdReason).toBe("tooOld");
        });
    });
});

describe("isEscalated", () => {
    it("is the admins' after the wait", () => {
        expect(isEscalated(at(-HOLD_ESCALATE_MS + 1000), now)).toBe(false);
        expect(isEscalated(at(-HOLD_ESCALATE_MS), now)).toBe(true);
    });
});
