import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getCurrentClientName } from "@/lib/currentClient";

/**
 * GET handler - Returns the display name of the current authenticated user's client
 *
 * @async
 * @returns {Promise<NextResponse>}
 * - Success: `{ name: string }`
 * - Unauthorized: `{ error: "No autorizado" }` with status 401
 * - Server error: `{ error: "Error interno del servidor" }` with status 500
 *
 * @requires Authentication session
 */
export async function GET() {
    const session = await auth();

    if (!session?.user?.activeOrganization) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    try {
        const name = await getCurrentClientName(session.user.activeOrganization);
        return NextResponse.json({ name });
    } catch (error) {
        console.error("GET Client Name Error:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}