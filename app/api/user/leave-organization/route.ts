import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { badRequest, forbidden, getDb, serverError, toObjectId, unauthorized } from "@/lib/api";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { isOrganizationOwner, otherActiveMemberships } from "@/lib/organizations";
import { findUserByEmail, forgetCachedUsers } from "@/lib/users";
import type { Organization, User } from "@/types/models";

/**
 * POST /api/user/leave-organization - Removes the user's membership in an organization. Body: { clientId }
 * Its owner can't leave it (they close it instead, see /api/admin/organization/close).
 * Returns { nextClientId }: the organization the client should switch the session to, null when none is left.
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.email) return unauthorized();

    try {
        const clientId = toObjectId((await req.json()).clientId);
        if (!clientId) return badRequest("missingOrganizationId");

        const db = await getDb();
        const organization = await db.collection<Organization>("clients").findOne({ _id: clientId }, { projection: { ownerEmail: 1 } });
        if (organization && isOrganizationOwner(session.user.email, organization)) return forbidden("ownerCannotLeave");

        const users = db.collection<User>("users");
        // Memberships migrated from the old top-level clientId may store it as a string
        const anyIdForm = { $in: [clientId, clientId.toString()] };
        await users.updateOne(
            { email: session.user.email, activeOrganization: anyIdForm } as object,
            { $set: { activeOrganization: null } }
        );
        await users.updateOne(
            { email: session.user.email },
            { $pull: { organizations: { clientId: anyIdForm } } } as object
        );
        forgetCachedUsers();

        const user = await findUserByEmail(session.user.email, { fresh: true });
        if (user) await db.collection("client_users").deleteMany({ userId: user._id, clientId });

        await logAudit(AUDIT_ACTIONS.LEAVE_ORGANIZATION, { actor: session.user, clientId, target: { type: "organization", id: clientId } });

        const nextClientId = otherActiveMemberships(user?.organizations, clientId.toString())[0]?.clientId.toString() ?? null;
        return NextResponse.json({ success: true, nextClientId });
    } catch (error) {
        console.error("Leave organization error:", error);
        return serverError();
    }
}
