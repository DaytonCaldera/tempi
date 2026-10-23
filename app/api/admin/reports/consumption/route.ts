import { NextResponse } from 'next/server';
import type { Document } from 'mongodb';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { badRequest, getDb, toObjectId, unauthorized } from '@/lib/api';
import { getTenantQuery } from '@/lib/tenant-guard';
import type { ConsumptionReportDepartment } from '@/types/models';

/** Sums IN and OUT amounts of the movements that match `createdAt`. */
const sumMovements = (createdAt: Document) => [
    { $match: { createdAt } },
    {
        $group: {
            _id: null,
            in: { $sum: { $cond: [{ $eq: ["$type", "IN"] }, "$amount", 0] } },
            out: { $sum: { $cond: [{ $eq: ["$type", "OUT"] }, "$amount", 0] } }
        }
    }
];

/**
 * GET /api/admin/reports/consumption?start=&end=&deptId=
 * For each department (or only deptId) and each of its products: the stock at the start of the range,
 * what came in and went out during the range, and the stock at the end of the range.
 */
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const deptId = searchParams.get('deptId');

    if (!start || !end) return badRequest("datesRequired");
    const startDate = new Date(start);
    const endDate = new Date(end);

    const departmentId = deptId ? toObjectId(deptId) : null;
    if (deptId && !departmentId) return badRequest("invalidDepartment");

    const t = await getTranslations('reports');
    const db = await getDb();
    const departments = await db.collection('departments')
        .find({ ...getTenantQuery(session), ...(departmentId && { _id: departmentId }) })
        .toArray();

    const report: ConsumptionReportDepartment[] = [];

    for (const department of departments) {
        const items = await db.collection('department_stock').aggregate([
            { $match: { departmentId: department._id } },
            {
                $lookup: {
                    from: "stock_movements",
                    let: { stockId: "$_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$inventoryId", "$$stockId"] } } },
                        {
                            $facet: {
                                inRange: sumMovements({ $gte: startDate, $lte: endDate }),
                                afterEnd: sumMovements({ $gt: endDate }), // From the end of the range until now
                            }
                        }
                    ],
                    as: "movements"
                }
            }
        ]).toArray();

        report.push({
            _id: department._id.toString(),
            departmentName: department.name,
            items: items.map(item => {
                const range = item.movements[0]?.inRange[0] || { in: 0, out: 0 };
                const after = item.movements[0]?.afterEnd[0] || { in: 0, out: 0 };

                // Work backwards from today's quantity: undo everything that happened since the range started
                const initialQuantity = (item.quantity || 0) - (range.in + after.in) + (range.out + after.out);
                const finalBalance = range.in - range.out;

                return {
                    inventoryId: item._id.toString(),
                    productName: item.productName || t('unnamedProduct'),
                    sku: item.sku || "N/A",
                    initialQuantity,
                    totalIn: range.in,
                    totalOut: range.out,
                    finalBalance,
                    finalQuantity: initialQuantity + finalBalance,
                };
            }),
        });
    }

    return NextResponse.json(report);
}
