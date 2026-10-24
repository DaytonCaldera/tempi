import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { forbidden, getDb, notFound, serverError, unauthorized } from "@/lib/api";
import { ROLES } from "@/lib/constants";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { ownedOpenOrganizations } from "@/lib/organizations";
import { findUserByEmail, forgetCachedUsers } from "@/lib/users";

/**
 * DELETE /api/user/account - Deletes the signed-in user: their document, Google account link and memberships.
 * Not allowed while they own an open organization (they close it first) or for the superadmin.
 * Stock movements store the name and email of who made them, so the organizations' history is unchanged.
 */
export async function DELETE() {
    const session = await auth();
    if (!session?.user?.email) return unauthorized();
    if (session.user.role === ROLES.SUPERADMIN) return forbidden();

    try {
        if ((await ownedOpenOrganizations(session.user.email)).length > 0) return forbidden("ownsOrganizations");

        const user = await findUserByEmail(session.user.email, { fresh: true });
        if (!user) return notFound("userNotFound");

        const db = await getDb();
        await db.collection("accounts").deleteMany({ userId: user._id });
        await db.collection("client_users").deleteMany({ userId: user._id });
        await db.collection("users").deleteOne({ _id: user._id });
        forgetCachedUsers();
        await logAudit(AUDIT_ACTIONS.DELETE_ACCOUNT, { actor: { id: user._id, email: user.email, name: user.name } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete account error:", error);
        return serverError();
    }
}
