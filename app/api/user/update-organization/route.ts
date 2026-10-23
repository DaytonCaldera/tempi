import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { badRequest, getDb, serverError, toObjectId, unauthorized } from "@/lib/api";
import { forgetCachedUsers } from "@/lib/users";

/**
 * POST /api/user/update-organization - Saves the organization the user switched to,
 * so the next sign-in starts there. Body: { clientId }
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.email) return unauthorized();

    try {
        const clientId = toObjectId((await req.json()).clientId);
        if (!clientId) return badRequest("missingOrganizationId");

        const db = await getDb();
        await db.collection("users").updateOne(
            { email: session.user.email },
            { $set: { activeOrganization: clientId } }
        );
        forgetCachedUsers();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Update active organization error:", error);
        return serverError();
    }
}
