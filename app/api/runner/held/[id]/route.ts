import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { apiError, badRequest, serverError, toObjectId, unauthorized } from "@/lib/api";
import { resolveHeld } from "@/lib/offline-sync-server";
import { afterStockChange } from "@/lib/stock-alerts";

/**
 * POST /api/runner/held/[id]
 * Applies or discards a held move. Body: { decision: "apply" | "discard" }.
 * Its runner can always; an admin of stock once it waited for the runner too long (lib/offline-sync.ts).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.email) return unauthorized();

    try {
        const heldId = toObjectId((await params).id);
        const { decision } = await req.json().catch(() => ({}));
        if (!heldId || (decision !== "apply" && decision !== "discard")) return badRequest("invalidData");

        const result = await resolveHeld(session, heldId, decision);
        if (!result.ok) {
            const status = result.error === "heldNotFound" ? 404 : result.error === "heldNotYours" ? 403 : 409;
            return apiError(result.error === "productGone" ? "productNotFoundOrDenied" : result.error, status);
        }
        if (result.changed) await afterStockChange(req, [result.changed]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Resolve held move error:", error);
        return serverError();
    }
}
