// app/api/user/join/route.ts
import mongo from '@/lib/mongodb';
import { auth } from "@/auth";
import { NextResponse } from 'next/server';
import { PLACEHOLDER_CLIENT_ID, ROLES } from '@/lib/constants';

export async function POST(req: Request) {
    const { code } = await req.json();
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);

    // 1. Find the client with this code
    const targetClient = await db.collection('clients').findOne({ clientCode: code });
    if (!targetClient) return NextResponse.json({ error: "Code not found" }, { status: 404 });

    // Remove the old placeholder org, otherwise it is picked over the joined org on the next sign-in
    await db.collection('users').updateOne(
        { email: session.user.email },
        { $pull: { organizations: { clientId: PLACEHOLDER_CLIENT_ID } } } as any
    );

    const userDoc = await db.collection('users').findOne({ email: session.user.email });

    // 2. Add this organization to the user's array, unless they already belong to it.
    // ($addToSet alone doesn't prevent duplicates because joinedAt is different on every call)
    const alreadyMember = userDoc?.organizations?.some((org: any) => org.clientId?.toString() === targetClient._id.toString());

    await db.collection('users').updateOne(
        { _id: userDoc?._id },
        {
            $set: { activeOrganization: targetClient._id }, // Sign-in resolves the role from this org
            ...(!alreadyMember && {
                $addToSet: {
                    organizations: {
                        clientId: targetClient._id,
                        role: ROLES.PENDING_USER, // They start as new_user until admin approves
                        status: "active",
                        joinedAt: new Date(),
                        clientName: targetClient.name
                    }
                }
            })
        }
    );

    await db.collection('client_users').updateOne(
        { userId: session.user.id, clientId: targetClient._id },
        { $set: { updatedAt: new Date(), userId: userDoc?._id, clientId: targetClient._id } },
        { upsert: true }
    );

    return NextResponse.json({ success: true, clientId: targetClient._id });
}
