import type { Document } from 'mongodb';
import { getTranslations } from 'next-intl/server';
import { getDb } from '@/lib/api';
import { MOVEMENT_REASONS } from '@/lib/constants';
import type { ConsumptionReportDepartment, MovementType } from '@/types/models';

/**
 * Server only: the consumption report. Used by GET /api/admin/reports/consumption (scoped to the session's
 * organization) and by the superadmin's read-only view of an organization.
 */

/** Amount of a movement of `type`, and minus the amount of a correction that reverses one (so an undone OUT isn't consumption). */
const signedAmount = (type: MovementType) => {
    const reversed = type === "IN" ? "OUT" : "IN";
    const isCorrection = { $eq: ["$reason", MOVEMENT_REASONS.CORRECTION] };
    return {
        $switch: {
            branches: [
                { case: { $and: [{ $eq: ["$type", reversed] }, isCorrection] }, then: { $multiply: ["$amount", -1] } },
                { case: { $and: [{ $eq: ["$type", type] }, { $not: [isCorrection] }] }, then: "$amount" },
            ],
            default: 0
        }
    };
};

/**
 * Sums IN and OUT amounts of the movements that match `createdAt`.
 * Corrections move between the columns, so `in - out` (and the balances built from it) is unchanged.
 */
const sumMovements = (createdAt: Document) => [
    { $match: { createdAt } },
    {
        $group: {
            _id: null,
            in: { $sum: signedAmount("IN") },
            out: { $sum: signedAmount("OUT") }
        }
    }
];

/**
 * For each department matching `departmentFilter` (always scoped to one organization by the caller) and each
 * of its products: the stock at the start of the range, what came in and went out, and the stock at the end.
 */
export async function buildConsumptionReport(departmentFilter: Document, startDate: Date, endDate: Date): Promise<ConsumptionReportDepartment[]> {
    const t = await getTranslations('reports');
    const db = await getDb();
    const departments = await db.collection('departments')
        .find(departmentFilter)
        .toArray();

    const report: ConsumptionReportDepartment[] = [];

    for (const department of departments) {
        const items = await db.collection('department_stock').aggregate([
            {
                $match: {
                    departmentId: department._id,
                    $and: [
                        // Items created after the range didn't exist yet
                        { $or: [{ createdAt: { $exists: false } }, { createdAt: { $lte: endDate } }] },
                        // Deleted items only while they still existed during the range
                        { $or: [{ isDeleted: { $ne: true } }, { deletedAt: { $gte: startDate } }] },
                    ]
                }
            },
            {
                $lookup: {
                    from: "stock_movements",
                    let: { stockId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$inventoryId", "$$stockId"] },
                                // Sync movements never changed the quantity, so they must not be undone or counted
                                reason: { $ne: MOVEMENT_REASONS.INITIAL_SYNC }
                            }
                        },
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

    return report;
}
