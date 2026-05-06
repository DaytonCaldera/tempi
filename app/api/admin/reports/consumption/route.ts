import { auth } from '@/auth';
import mongo from '@/lib/mongodb';
import { getTenantQuery } from '@/lib/tenant-guard';
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const session = await auth();
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start'); // e.g. 2026-03-31T08:00:00Z
    const end = searchParams.get('end');     // e.g. 2026-03-31T18:00:00Z
    const deptId = searchParams.get('deptId');

    if (!start || !end) return NextResponse.json({ error: "Fechas requeridas" }, { status: 400 });

    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);

    // Inside GET function
    const query: any = getTenantQuery(session);
    query.createdAt = {
        $gte: new Date(start),
        $lte: new Date(end)
    };
    if (deptId) query.departmentId = new ObjectId(deptId);
    console.log(query);
    
    const report = await db.collection('stock_movements').aggregate([
        { $match: query },
        {
            $group: {
                _id: {
                    deptId: "$departmentId",
                    prodId: "$inventoryId"
                },
                // We take the name directly from the log itself!
                departmentName: { $first: "$departmentName" },
                productName: { $first: "$productName" },
                sku: { $first: "$sku" },
                totalIn: { $sum: { $cond: [{ $eq: ["$type", "IN"] }, "$amount", 0] } },
                totalOut: { $sum: { $cond: [{ $eq: ["$type", "OUT"] }, "$amount", 0] } }
            }
        },
        {
            $group: {
                _id: "$_id.deptId",
                departmentName: { $first: "$departmentName" },
                items: {
                    $push: {
                        inventoryId: "$_id.prodId",
                        productName: "$productName",
                        sku: "$sku",
                        totalIn: "$totalIn",
                        totalOut: "$totalOut"
                    }
                }
            }
        },
        { $sort: { departmentName: 1 } }
    ]).toArray();

    return NextResponse.json(report);
}