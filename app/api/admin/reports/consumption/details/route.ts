import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { badRequest, getDb, notFound, toObjectId, unauthorized } from '@/lib/api';
import { getTenantQuery } from '@/lib/tenant-guard';

/**
 * GET /api/admin/reports/consumption/details?inventoryId=&start=&end=
 * Movement log of one stock item within a date range, newest first.
 * Only items from departments of the user's organization can be read.
 */
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const inventoryId = toObjectId(searchParams.get('inventoryId'));
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!inventoryId || !start || !end) return badRequest("Faltan parámetros");

    const db = await getDb();

    // Verify the item belongs to a department of this organization
    const item = await db.collection('department_stock').findOne({ _id: inventoryId });
    const department = item && await db.collection('departments').findOne({
        _id: item.departmentId,
        ...getTenantQuery(session)
    });
    if (!department) return notFound("Producto no encontrado");

    const logs = await db.collection('stock_movements')
        .find({
            inventoryId,
            createdAt: { $gte: new Date(start), $lte: new Date(end) },
            // Movements created by the sync tool are not real consumption
            reason: { $ne: "Sincronización inicial del sistema" }
        })
        .sort({ createdAt: -1 })
        .toArray();

    return NextResponse.json(logs);
}
