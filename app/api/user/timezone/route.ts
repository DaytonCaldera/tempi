import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { badRequest, getDb, serverError, unauthorized } from "@/lib/api";
import { isTimeZone } from "@/lib/timezone";
import { forgetCachedUsers } from "@/lib/users";

/**
 * PATCH /api/user/timezone - The time zone the user's dates show in (lib/timezone.ts), on every device.
 * Body: { timeZone: string | null } (an IANA zone, or null to follow the browser's). The client then calls
 * useSession().update() so the session picks it up.
 */
export async function PATCH(req: Request) {
    const session = await auth();
    if (!session?.user?.email) return unauthorized();

    try {
        const { timeZone } = await req.json().catch(() => ({}));
        if (timeZone !== null && !isTimeZone(timeZone)) return badRequest("invalidTimeZone");

        const db = await getDb();
        await db.collection("users").updateOne(
            { email: session.user.email },
            timeZone ? { $set: { timeZone } } : { $unset: { timeZone: "" } }
        );
        forgetCachedUsers();
        return NextResponse.json({ timeZone });
    } catch (error) {
        console.error("Update time zone error:", error);
        return serverError();
    }
}
