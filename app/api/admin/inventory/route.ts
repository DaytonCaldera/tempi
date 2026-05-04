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

        const userDepartments = userDoc?.organizations?.flatMap((org:any) => org.departments) || [];
        const hasValidDepartments = userDepartments.length > 0;

        if (!hasValidDepartments) {
            return NextResponse.json([]);
        }

        // 2. Fetch inventory only for those specific departments
        const inventory = await db.collection('department_stock')
            .find({
                departmentId: { $in: userDepartments }
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