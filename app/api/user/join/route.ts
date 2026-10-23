import { NextResponse } from 'next/server';
import { auth } from "@/auth";
import { getDb, notFound, unauthorized } from '@/lib/api';
import { PLACEHOLDER_CLIENT_ID, ROLES } from '@/lib/constants';
import { OPEN_ORGANIZATION } from '@/lib/organizations';
import type { User } from '@/types/models';

/**
 * POST /api/user/join - Joins the organization with the given code as a pending user,
 * until an admin approves them. Body: { code }
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { code } = await req.json();
    const db = await getDb();

    const organization = await db.collection('clients').findOne({ clientCode: code, ...OPEN_ORGANIZATION });
    if (!organization) return notFound("invalidCode");

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

    return NextResponse.json({ success: true, clientId: organization._id });
}
