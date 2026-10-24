import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authorize';
import { badRequest, getDb, notFound, toObjectId } from '@/lib/api';
import { MOVEMENT_REASONS, PERMISSIONS } from '@/lib/constants';
import { historyHeaders, reportRange } from '@/lib/consumption';
import { getTenantQuery } from '@/lib/tenant-guard';

/**
 * GET /api/admin/reports/consumption/details?inventoryId=&start=&end=
 * Movement log of one stock item within a date range, newest first.
 * Only items from departments of the user's organization can be read.
 */
export async function GET(req: Request) {
    const { session, error } = await requirePermission(PERMISSIONS.VIEW_REPORTS);
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const inventoryId = toObjectId(searchParams.get('inventoryId'));
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!inventoryId || !start || !end) return badRequest("missingParameters");

    const db = await getDb();

    // Verify the item belongs to a department of this organization
    const item = await db.collection('department_stock').findOne({ _id: inventoryId });
    const department = item && await db.collection('departments').findOne({
        _id: item.departmentId,
        ...getTenantQuery(session)
    });
    if (!department) return notFound("productNotFound");

    const { start: startDate, limitedFrom } = await reportRange(department.clientId, new Date(start));
    const logs = await db.collection('stock_movements')
        .find({
            inventoryId,
            createdAt: { $gte: startDate, $lte: new Date(end) },
            // Movements created by the sync tool are not real consumption
            reason: { $ne: MOVEMENT_REASONS.INITIAL_SYNC }
        })
        .sort({ createdAt: -1 })
        .toArray();

    return NextResponse.json(logs, { headers: historyHeaders(limitedFrom) });
}
