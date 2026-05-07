import { auth } from "@/auth";
import mongo from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { clientId } = await req.json();
        if (!clientId) {
            return NextResponse.json({ error: "Missing Client ID" }, { status: 400 });
        }

        const client = await mongo;
        const db = client.db(process.env.MONGODB_DB);

        // Update the user's root 'clientId' field. 
        // This acts as their "Preferred/Last Active" organization.
        await db.collection("users").updateOne(
            { email: session.user.email },
            { 
                $set: { 
                    activeOrganization: new ObjectId(clientId) 
                } 
            }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("UPDATE_ORG_ERROR", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}