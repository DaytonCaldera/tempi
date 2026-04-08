import { auth } from "@/auth"; // Added
import mongo from '@/lib/mongodb';
import { ObjectId } from "mongodb";

export async function GET(req: Request) {
    const session = await auth(); // Added Security
    if (!session?.user?.clientId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const deptId = searchParams.get('deptId');
    if (!deptId) return Response.json({ users: [] });

    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);

    const users = await db.collection('users')
        .find({ 
            clientId: new ObjectId(session.user.clientId), // ANCHOR: Filter by client
            departments: new ObjectId(deptId)
        })
        .project({ name: 1, role: 1, isActive: 1 })
        .toArray();

    return Response.json({ users });
}