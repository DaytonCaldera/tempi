import { NextResponse } from 'next/server';
import { auth } from "@/auth";
import { apiError, getDb, notFound, unauthorized } from '@/lib/api';
import { PLACEHOLDER_CLIENT_ID, ROLES } from '@/lib/constants';
import { joinCodeCandidates, OPEN_ORGANIZATION } from '@/lib/organizations';
import { createRateLimiter } from '@/lib/rate-limit';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { forgetCachedUsers } from '@/lib/users';
import type { User } from '@/types/models';

/** Wrong codes allowed per user before joining is paused, so codes can't be guessed by trying them all. */
const failedJoins = createRateLimiter({ max: 10, windowMs: 15 * 60_000 });

/**
 * POST /api/user/join - Joins the organization with the given code as a pending user,
 * until an admin approves them. Body: { code }
 * The code can be typed with or without its dash (the staff page copies it without one).
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.email) return unauthorized();

    const limitKey = session.user.email.toLowerCase();
    if (failedJoins.isLimited(limitKey)) return apiError("tooManyAttempts", 429);

    const { code } = await req.json();
    const candidates = joinCodeCandidates(code);
    const db = await getDb();

    const organization = candidates.length > 0
        ? await db.collection('clients').findOne({ clientCode: { $in: candidates }, ...OPEN_ORGANIZATION })
        : null;
    if (!organization) {
        failedJoins.hit(limitKey);
        return notFound("invalidCode");
    }

    const users = db.collection<User>('users');

    // Remove the old placeholder org, otherwise it is picked over the joined org on the next sign-in
    await users.updateOne(
        { email: session.user.email ?? undefined },
        { $pull: { organizations: { clientId: PLACEHOLDER_CLIENT_ID } } } as object
    );

    const userDoc = await users.findOne({ email: session.user.email ?? undefined });

    // $addToSet alone doesn't prevent duplicates because joinedAt is different on every call
    const alreadyMember = userDoc?.organizations?.some(m => m.clientId.toString() === organization._id.toString());

    await users.updateOne(
        { _id: userDoc?._id },
        {
            $set: { activeOrganization: organization._id }, // Sign-in resolves the role from this org
            ...(!alreadyMember && {
                $addToSet: {
                    organizations: {
                        clientId: organization._id,
                        clientName: organization.name,
                        role: ROLES.PENDING_USER,
                        status: "active",
                        joinedAt: new Date(),
                    }
                }
            })
        }
    );

    await db.collection('client_users').updateOne(
        { userId: session.user.id, clientId: organization._id },
        { $set: { updatedAt: new Date(), userId: userDoc?._id, clientId: organization._id } },
        { upsert: true }
    );
    forgetCachedUsers();
    if (!alreadyMember) {
        await logAudit(AUDIT_ACTIONS.JOIN_ORGANIZATION, {
            actor: session.user, clientId: organization._id, target: { type: "organization", id: organization._id, label: organization.name },
        });
    }

    return NextResponse.json({ success: true, clientId: organization._id });
}
