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
        const { userId, isActive, departments } = await request.json();
        const client = await mongo;
        const db = client.db(process.env.MONGODB_DB);

        // 2. Perform the Update
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { 
                $set: { 
                    isActive: isActive,
                    departments: departments.map((id: string) => new ObjectId(id))
                } 
            }
        );
        console.log(result);
        
        if (result.modifiedCount === 0 && result.matchedCount === 0) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        if (result.modifiedCount === 0 && result.matchedCount === 1) {
            return NextResponse.json({ message: "No changes made" }, { status: 200 });
        }

        return NextResponse.json({ success: true, newState: !isActive });
    } catch (error) {
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}