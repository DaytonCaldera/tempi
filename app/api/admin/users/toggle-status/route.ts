import mongo from '@/lib/mongodb';
import { auth } from "@/auth";
import { ROLES } from "@/lib/constants";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(request: NextRequest) {
    const session = await auth();

    // 1. Security Check: Only Admin or Superadmin
    const allowedRoles = [ROLES.ADMIN, ROLES.SUPERADMIN];
    if (!session || !allowedRoles.includes(session.user.role)) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const { userId, isActive, departments, role } = await request.json();

        // 🛡️ SECURITY GATE: Prevent non-superadmins from assigning the superadmin role
        if (role === ROLES.SUPERADMIN && session.user.role !== ROLES.SUPERADMIN) {
            return NextResponse.json({ message: "Forbidden: Cannot assign Superadmin role" }, { status: 403 });
        }

        const client = await mongo;
        const db = client.db(process.env.MONGODB_DB);

        // 2. Perform the Update
        const result = await db.collection('users').updateOne(
            {
                _id: new ObjectId(userId),
                // ANCHOR: Regular admins can only edit users within their company
                ...(session.user.role !== ROLES.SUPERADMIN && { clientId: new ObjectId(session.user.clientId) })
            },
            {
                $set: {
                    isActive: isActive,
                    departments: departments.map((id: string) => new ObjectId(id)),
                    role: role // 🔥 Now dynamic from the selection modal
                }
            }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json({ message: "User not found or access denied" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("PATCH_USER_ERROR:", error);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}