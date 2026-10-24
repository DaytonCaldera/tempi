import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { badRequest, getDb, serverError, unauthorized } from "@/lib/api";
import { forgetCachedUsers } from "@/lib/users";
import type { StartPage } from "@/types/models";

const START_PAGES: StartPage[] = ["runner", "dashboard"];

/**
 * POST /api/user/start-page - Saves the page the user lands on after signing in (see app/(main)/page.tsx).
 * Body: { startPage: "runner" | "dashboard" }
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.email) return unauthorized();

    try {
        const { startPage } = await req.json();
        if (!START_PAGES.includes(startPage)) return badRequest();

        const db = await getDb();
        await db.collection("users").updateOne({ email: session.user.email }, { $set: { startPage } });
        forgetCachedUsers();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Update start page error:", error);
        return serverError();
    }
}
