import { auth } from "@/auth";
import mongo from '@/lib/mongodb';
import { ObjectId } from "mongodb";

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.activeOrganization) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const deptId = searchParams.get('deptId');
    if (!deptId) return Response.json({ users: [] });

    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);

    const clientObjectId = new ObjectId(session.user.activeOrganization);
    const deptObjectId = new ObjectId(deptId);

    const users = await db.collection('users')
        .find({
            organizations: {
                $elemMatch: {
                    clientId: clientObjectId,
                    departments: deptObjectId
                }
            }
        })
        .project({
            name: 1,
            isActive: 1,
            // $elemMatch in a projection returns only the ONE matching array element,
            // not the whole organizations array
            organizations: { $elemMatch: { clientId: clientObjectId, departments: deptObjectId } }
        })
        .toArray();

    const flattened = users.map(user => ({
        _id: user._id.toString(),
        name: user.name,
        isActive: user.isActive,
        role: user.organizations?.[0]?.role ?? null
    }));

    return Response.json({ users: flattened });
}