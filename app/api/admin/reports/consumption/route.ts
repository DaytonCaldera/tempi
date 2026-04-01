import mongo from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start'); // e.g. 2026-03-31T08:00:00Z
    const end = searchParams.get('end');     // e.g. 2026-03-31T18:00:00Z
    const deptId = searchParams.get('deptId');

    if (!start || !end) return NextResponse.json({ error: "Fechas requeridas" }, { status: 400 });

    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);

    const query: any = {
        createdAt: { $gte: new Date(start), $lte: new Date(end) }
    };
    if (deptId) query.departmentId = new ObjectId(deptId);

    const report = await db.collection('stock_movements').aggregate([
        { $match: query },
        {
            $group: {
                _id: "$inventoryId",
                productName: { $first: "$productName" },
                sku: { $first: "$sku" },
                // Total "Entradas"
                totalIn: {
                    $sum: { $cond: [{ $eq: ["$type", "IN"] }, "$amount", 0] }
                },
                // Total "Salidas" (Consumption)
                totalOut: {
                    $sum: { $cond: [{ $eq: ["$type", "OUT"] }, "$amount", 0] }
                },
                // How many times it was touched
                movementsCount: { $sum: 1 }
            }
        },
        { $sort: { totalOut: -1 } } // Show most consumed first
    ]).toArray();

    return NextResponse.json(report);
}