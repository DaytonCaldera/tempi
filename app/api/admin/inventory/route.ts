import { auth } from '@/auth';
import mongo from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const client = await mongo;
        const db = client.db(process.env.MONGODB_DB);

        // 1. Get the user's assigned departments
        const userDoc = await db.collection("users").findOne({ email: session.user.email });
        
        if (!userDoc?.departments || userDoc.departments.length === 0) {
            return NextResponse.json([]);
        }

        // 2. Fetch inventory only for those specific departments
        const inventory = await db.collection('department_stock')
            .find({ 
                departmentId: { $in: userDoc.departments } 
            })
            .sort({ productName: 1 })
            .toArray();

        // 3. Clean up the data for the frontend
        return NextResponse.json(inventory.map(item => ({
            ...item,
            _id: item._id.toString(),
            departmentId: item.departmentId.toString()
        })));

    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}