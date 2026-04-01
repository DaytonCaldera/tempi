import mongo from '@/lib/mongodb';
import { ObjectId } from "mongodb";
import { auth } from "@/auth";
import { ROLES } from '@/lib/constants';

export async function POST(req: Request) {
    const session = await auth();
    if (!session || session.user.role !== ROLES.ADMIN) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { userId, departmentIds } = await req.json();

    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);

    await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { 
            $set: { 
                isActive: true, 
                departments: departmentIds.map((id: string) => new ObjectId(id)),
                updatedAt: new Date()
            } 
        }
    );

    return Response.json({ success: true });
}