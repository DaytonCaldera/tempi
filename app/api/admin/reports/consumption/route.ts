import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authorize';
import { badRequest, toObjectId } from '@/lib/api';
import { buildConsumptionReport, historyHeaders, reportRange } from '@/lib/consumption';
import { PERMISSIONS } from '@/lib/constants';
import { getTenantQuery } from '@/lib/tenant-guard';

/**
 * GET /api/admin/reports/consumption?start=&end=&deptId=
 * For each department (or only deptId) and each of its products: the stock at the start of the range,
 * what came in and went out during the range, and the stock at the end of the range.
 * A start older than the plan's history is moved forward to it (see historyHeaders).
 */
export async function GET(req: Request) {
    const { session, error } = await requirePermission(PERMISSIONS.VIEW_REPORTS);
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const deptId = searchParams.get('deptId');

    if (!start || !end) return badRequest("datesRequired");
    const clientId = toObjectId(session.user.clientId);
    const { start: startDate, limitedFrom } = await reportRange(clientId, new Date(start));
    const endDate = new Date(end);

    const departmentId = deptId ? toObjectId(deptId) : null;
    if (deptId && !departmentId) return badRequest("invalidDepartment");

    const report = await buildConsumptionReport({ ...getTenantQuery(session), ...(departmentId && { _id: departmentId }) }, startDate, endDate);
    return NextResponse.json(report, { headers: historyHeaders(limitedFrom) });
}
