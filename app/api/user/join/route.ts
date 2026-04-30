// app/api/user/join/route.ts
import mongo from '@/lib/mongodb';
import { auth } from "@/auth";
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const { code } = await req.json();
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);

    // 1. Find the client with this code
    const targetClient = await db.collection('clients').findOne({ code: code });
    if (!targetClient) return NextResponse.json({ error: "Code not found" }, { status: 404 });

    // 2. Add this organization to the user's array
    await db.collection('users').updateOne(
        { email: session.user.email },
        { 
            $addToSet: { 
                organizations: {
                    clientId: targetClient._id,
                    role: "new_user", // They start as new_user until admin approves
                    status: "active",
                    joinedAt: new Date()
                } 
            } 
        }
    );

    return NextResponse.json({ success: true });
}