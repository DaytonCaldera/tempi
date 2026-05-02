import mongo from '@/lib/mongodb';
import { ObjectId } from "mongodb";
import { auth } from "@/auth";
import { ROLES } from '@/lib/constants';

export async function POST(req: Request) {
    const session = await auth();
    // Only Admins or Superadmins can approve
    if (!session || session.user.role === ROLES.USER) {
        return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    const { userId, deptId } = await req.json();

    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);

    await db.collection('users').updateOne(
        { 
            _id: new ObjectId(userId),
            "organizations.clientId": new ObjectId(session.user.clientId)
        },
        { 
            $set: { 
                "organizations.$.role": ROLES.USER, 
                "organizations.$.status": 'active',
                "organizations.$.departments": [new ObjectId(deptId)]
            }
        }
    );

    return Response.json({ success: true });
}