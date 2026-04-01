import mongo from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const inventoryId = searchParams.get('inventoryId');
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!inventoryId || !start || !end) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);

    const logs = await db.collection('stock_movements')
        .find({
            inventoryId: new ObjectId(inventoryId),
            createdAt: { $gte: new Date(start), $lte: new Date(end) }
        })
        .sort({ createdAt: -1 }) // Newest first
        .toArray();

    return NextResponse.json(logs);
}