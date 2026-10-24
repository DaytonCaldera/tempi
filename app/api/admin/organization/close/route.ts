import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { badRequest, forbidden, getDb, notFound, serverError, toObjectId, unauthorized } from "@/lib/api";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { canCloseOrganization, closeOrganization, OPEN_ORGANIZATION, otherActiveMemberships } from "@/lib/organizations";
import { findUserByEmail } from "@/lib/users";
import type { Organization } from "@/types/models";

/**
 * POST /api/admin/organization/close
 * Closes the user's active organization (see closeOrganization). Only its owner can do it.
 * Body: { confirmName, acknowledgeLastOrganization }
 * - confirmName: the organization's name, typed by the user to confirm.
 * - acknowledgeLastOrganization: required when it is the user's last organization (they are left without one).
 * Returns { nextClientId }: the organization the client should switch the session to, or null when the user has none left.
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

        const { confirmName, acknowledgeLastOrganization } = await req.json();
        if (typeof confirmName !== "string" || confirmName.trim() !== organization.name.trim()) {
            return badRequest("organizationNameMismatch");
        }

        const user = await findUserByEmail(session.user.email, { fresh: true });
        const remaining = otherActiveMemberships(user?.organizations, clientId.toString());
        if (remaining.length === 0 && acknowledgeLastOrganization !== true) {
            return badRequest("lastOrganizationNotAcknowledged");
        }

        if (!await closeOrganization(clientId.toString(), session.user.email)) return notFound();
        await logAudit(AUDIT_ACTIONS.CLOSE_ORGANIZATION, {
            actor: session.user, clientId, target: { type: "organization", id: clientId, label: organization.name },
        });

        const nextClientId = remaining[0]?.clientId.toString() ?? null;
        return NextResponse.json({ success: true, nextClientId });
    } catch (error) {
        console.error("Close organization error:", error);
        return serverError();
    }
}
