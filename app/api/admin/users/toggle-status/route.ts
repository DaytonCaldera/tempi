import mongo from '@/lib/mongodb';
import { auth } from "@/auth";
import { ROLES } from "@/lib/constants";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(request: NextRequest) {
    const session = await auth();

    const allowedRoles = [ROLES.ADMIN, ROLES.SUPERADMIN];
    if (!session || !allowedRoles.includes(session.user.role)) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const { userId, isActive, departments, role, targetClientId } = await request.json();
        

        if (role === ROLES.SUPERADMIN && session.user.role !== ROLES.SUPERADMIN) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        // Determine which organization we are modifying
        // If not a Superadmin, we MUST use the admin's own clientId
        const clientIdToUpdate = session.user.role === ROLES.SUPERADMIN 
            ? new ObjectId(targetClientId) 
            : new ObjectId(session.user.clientId);

        const client = await mongo;
        const db = client.db(process.env.MONGODB_DB);

        const result = await db.collection('users').updateOne(
            {
                _id: new ObjectId(userId),
                // Find the specific organization entry in the array
                "organizations.clientId": clientIdToUpdate
            },
            {
                $set: {
                    // Using the '$' operator to update the matched array element
                    "organizations.$.status": isActive ? 'active' : 'inactive',
                    "organizations.$.role": role,
                    "organizations.$.departments": departments.map((id: string) => new ObjectId(id)),
                    activeOrganization: clientIdToUpdate
                }
            }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json({ message: "User or Organization not found" }, { status: 404 });
        }

        console.log(result, role, clientIdToUpdate);
        

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("PATCH_USER_ERROR:", error);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}