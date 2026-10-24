import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { serverError, unauthorized } from "@/lib/api";
import { getNotifications } from "@/lib/notifications";

/**
 * GET /api/notifications
 * What the navbar's bell shows (lib/notifications.ts): the user's low stock and held moves.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.email) return unauthorized();

    try {
        return NextResponse.json(await getNotifications(session));
    } catch (error) {
        console.error("Notifications error:", error);
        return serverError();
    }
}
