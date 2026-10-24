import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { badRequest, serverError, unauthorized } from "@/lib/api";
import { parseQueuedMoves } from "@/lib/offline-sync";
import { syncQueuedMoves } from "@/lib/offline-sync-server";
import { afterStockChange } from "@/lib/stock-alerts";

/**
 * POST /api/runner/sync
 * Applies the moves the runner made without connection (lib/offline-sync.ts). Body: { moves: QueuedMove[] }.
 * Each one is applied, or held for a person to decide (too old, a possible duplicate, stock short, ...). Sending the
 * same move again applies nothing new: the answer says what happened the first time.
 * Responds { results: SyncResult[] }, one per well formed move (malformed ones are left out).
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.email) return unauthorized();

    try {
        const moves = parseQueuedMoves(await req.json().catch(() => null));
        if (!moves) return badRequest("invalidData");

        const { results, changed } = await syncQueuedMoves(session, moves);
        // Low stock alerts, like any move
        await afterStockChange(req, changed);
        return NextResponse.json({ results });
    } catch (error) {
        console.error("Runner sync error:", error);
        return serverError();
    }
}
