import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/authorize';
import { badRequest, toObjectId, unauthorized } from '@/lib/api';
import { buildConsumptionReport, reportRange } from '@/lib/consumption';
import { PERMISSIONS, PLAN_FEATURES } from '@/lib/constants';
import { csvResponse } from '@/lib/csv';
import { planFeatureError } from '@/lib/plans';
import { getTenantQuery } from '@/lib/tenant-guard';

/**
 * GET /api/admin/reports/export?start=&end=&deptId= - The consumption report (same query and history limit as
 * GET /api/admin/reports/consumption) as a CSV file, one row per product. Needs the plan's CSV export.
 */
export async function GET(req: Request) {
    const { session, error } = await requirePermission(PERMISSIONS.VIEW_REPORTS);
    if (error) return error;
    const clientId = toObjectId(session.user.clientId);
    if (!clientId) return unauthorized();

    const featureError = await planFeatureError(clientId, PLAN_FEATURES.EXPORT_CSV);
    if (featureError) return featureError;

    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const deptId = searchParams.get('deptId');
    if (!start || !end) return badRequest("datesRequired");

    const departmentId = deptId ? toObjectId(deptId) : null;
    if (deptId && !departmentId) return badRequest("invalidDepartment");

    const { start: startDate } = await reportRange(clientId, new Date(start));
    const report = await buildConsumptionReport({ ...getTenantQuery(session), ...(departmentId && { _id: departmentId }) }, startDate, new Date(end));

    const t = await getTranslations('reports');
    const header = ["department", "sku", "product", "initial", "in", "out", "transferIn", "transferOut", "balance", "final", "unitCost", "consumedValue"].map(key => t(`columns.${key}`));
    const rows = report.flatMap(department => department.items.map(item => [
        department.departmentName, item.sku, item.productName, item.initialQuantity, item.totalIn, item.totalOut, item.transferIn, item.transferOut, item.finalBalance, item.finalQuantity,
        item.unitCost ?? "", item.consumedValueIncomplete && !item.consumedValue ? "" : item.consumedValue,
    ]));
    return csvResponse("consumo", header, rows);
}
