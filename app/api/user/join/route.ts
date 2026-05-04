// app/api/user/join/route.ts
import mongo from '@/lib/mongodb';
import { auth } from "@/auth";
import { NextResponse } from 'next/server';
import { ROLES } from '@/lib/constants';

export async function POST(req: Request) {
    const { code } = await req.json();
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);

    // 1. Find the client with this code
    const targetClient = await db.collection('clients').findOne({ clientCode: code });
    if (!targetClient) return NextResponse.json({ error: "Code not found" }, { status: 404 });
    
    // check if users has in organzation with clientId 'sup22' and delete that ntry
    await db.collection('users').updateOne(
        { email: session.user.email },
        { $pull: { organizations: { clientId: 'sup22' } } } as any
    );

    const userDoc = await db.collection('users').findOne({ email: session.user.email });

    // 2. Add this organization to the user's array
    await db.collection('users').updateOne(
        { _id: userDoc?._id },
        { 
            $addToSet: { 
                organizations: {
                    clientId: targetClient._id,
                    role: ROLES.PENDING_USER, // They start as new_user until admin approves
                    status: "active",
                    joinedAt: new Date(),
                    clientName: targetClient.name
                } 
            } 
        }
    );

    await db.collection('client_users').updateOne(
        { userId: session.user.id, clientId: targetClient._id },
        { $set: { updatedAt: new Date(), userId: userDoc?._id, clientId: targetClient._id } },
        { upsert: true }
    );

    return NextResponse.json({ success: true, clientId: targetClient._id });
}