import mongo from '@/lib/mongodb';
import { auth } from "@/auth";
import { ROLES } from "@/lib/constants";
import { ObjectId } from "mongodb";

export async function PATCH(request: Request) {
    const session = await auth();
    
    // 1. Security Check: Only Admin or Superadmin
    const allowedRoles = [ROLES.ADMIN, ROLES.SUPERADMIN];
    if (!session || !allowedRoles.includes(session.user.role)) {
        return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const { userId, isActive } = await request.json();
        const client = await mongo;
        const db = client.db(process.env.MONGODB_DB);

        // 2. Perform the Update
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { isActive: !isActive } } // Toggles the current state
        );

        if (result.modifiedCount === 0) {
            return Response.json({ message: "User not found" }, { status: 404 });
        }

        return Response.json({ success: true, newState: !isActive });
    } catch (error) {
        return Response.json({ message: "Server error" }, { status: 500 });
    }
}