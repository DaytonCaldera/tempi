import { requirePermission } from '@/lib/authorize';
import { badRequest, toObjectId, unauthorized } from '@/lib/api';
import { buildConsumptionReport, reportRange } from '@/lib/consumption';
import { PERMISSIONS } from '@/lib/constants';
import { getOrganizationCurrency } from '@/lib/organizations';
import { REPORT_FORMATS, reportFileResponse, type ReportFormat } from '@/lib/report-export';
import { getTenantQuery } from '@/lib/tenant-guard';

/**
 * GET /api/admin/reports/export?start=&end=&deptId=&format=csv|xlsx|pdf - The consumption report (same query and
 * history limit as GET /api/admin/reports/consumption) as a file. CSV when no format is given. Every plan has it.
 */
export async function GET(req: Request) {
    const { session, error } = await requirePermission(PERMISSIONS.VIEW_REPORTS);
    if (error) return error;
    const clientId = toObjectId(session.user.clientId);
    if (!clientId) return unauthorized();

    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const deptId = searchParams.get('deptId');
    const format = (searchParams.get('format') ?? "csv") as ReportFormat;
    if (!start || !end) return badRequest("datesRequired");
    if (!REPORT_FORMATS.includes(format)) return badRequest("invalidFormat");

    const departmentId = deptId ? toObjectId(deptId) : null;
    if (deptId && !departmentId) return badRequest("invalidDepartment");

    const { start: startDate } = await reportRange(clientId, new Date(start));
    const endDate = new Date(end);
    const report = await buildConsumptionReport({ ...getTenantQuery(session), ...(departmentId && { _id: departmentId }) }, startDate, endDate);

    return reportFileResponse(format, {
        report, start: startDate, end: endDate, singleDepartment: !!departmentId, currency: await getOrganizationCurrency(clientId),
    });
}
