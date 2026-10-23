import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { serverError, unauthorized } from "@/lib/api";
import { getOrganizationName } from "@/lib/organizations";

/** GET /api/admin/clients/name - Name of the user's active organization: `{ name }`. */
export async function GET() {
    const session = await auth();
    if (!session?.user?.activeOrganization) return unauthorized();

    try {
        const name = await getOrganizationName(session.user.activeOrganization);
        return NextResponse.json({ name });
    } catch (error) {
        console.error("GET organization name error:", error);
        return serverError();
    }
}
