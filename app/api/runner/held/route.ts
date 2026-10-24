import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { serverError, unauthorized } from "@/lib/api";
import { listHeld } from "@/lib/offline-sync-server";

/**
 * GET /api/runner/held
 * The pending held moves the user can decide (lib/offline-sync-server.ts listHeld): their own, and for admins of
 * stock the organization's that waited for their runner too long.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.email) return unauthorized();

    try {
        return NextResponse.json(await listHeld(session));
    } catch (error) {
        console.error("List held moves error:", error);
        return serverError();
    }
}
