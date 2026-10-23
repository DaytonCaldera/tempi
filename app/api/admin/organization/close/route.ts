import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { badRequest, forbidden, getDb, notFound, serverError, toObjectId, unauthorized } from "@/lib/api";
import { canCloseOrganization, closeOrganization, OPEN_ORGANIZATION } from "@/lib/organizations";
import type { Organization } from "@/types/models";

/**
 * POST /api/admin/organization/close
 * Closes the user's active organization (see closeOrganization). Only its owner or the superadmin can do it.
 * Body: { confirmName } - the organization's name, typed by the user to confirm.
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.email) return unauthorized();

    try {
        const clientId = toObjectId(session.user.clientId);
        if (!clientId) return badRequest("missingOrganizationId");

        const db = await getDb();
        const organization = await db.collection<Organization>("clients").findOne({ _id: clientId, ...OPEN_ORGANIZATION });
        if (!organization) return notFound();
        if (!canCloseOrganization(session, organization)) return forbidden();

        const { confirmName } = await req.json();
        if (typeof confirmName !== "string" || confirmName.trim() !== organization.name.trim()) {
            return badRequest("organizationNameMismatch");
        }

        if (!await closeOrganization(clientId.toString(), session.user.email)) return notFound();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Close organization error:", error);
        return serverError();
    }
}
