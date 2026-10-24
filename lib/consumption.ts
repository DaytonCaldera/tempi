import type { Document, ObjectId } from 'mongodb';
import { getTranslations } from 'next-intl/server';
import { getDb } from '@/lib/api';
import { MOVEMENT_REASONS } from '@/lib/constants';
import { clampToHistory, getOrganizationPlan } from '@/lib/plans';
import type { ConsumptionReportDepartment, MovementType } from '@/types/models';

/**
 * Server only: the consumption report. Used by GET /api/admin/reports/consumption (scoped to the session's
 * organization) and by the superadmin's read-only view of an organization.
 */

/** Response header that tells the client the report was cut to the plan's history (lib/plans.ts clampToHistory). */
export const HISTORY_LIMITED_HEADER = "X-History-Limited-From";

/** The start date the organization's plan allows for a report that starts at `start`. */
export async function reportRange(clientId: ObjectId | null, start: Date) {
    if (!clientId) return { start, limitedFrom: null };
    return clampToHistory(await getOrganizationPlan(clientId), start);
}

export const historyHeaders = (limitedFrom: Date | null): Record<string, string> =>
    limitedFrom ? { [HISTORY_LIMITED_HEADER]: limitedFrom.toISOString() } : {};

const isTransfer = { $eq: ["$reason", MOVEMENT_REASONS.TRANSFER] };

/**
 * Amount of a movement of `type`, and minus the amount of a correction that reverses one (so an undone OUT isn't
 * consumption). Transfers between departments aren't in or out here: they have their own columns.
 */
const signedAmount = (type: MovementType) => {
    const reversed = type === "IN" ? "OUT" : "IN";
    const isCorrection = { $eq: ["$reason", MOVEMENT_REASONS.CORRECTION] };
    return {
        $switch: {
            branches: [
                { case: { $and: [{ $eq: ["$type", reversed] }, isCorrection] }, then: { $multiply: ["$amount", -1] } },
                { case: { $and: [{ $eq: ["$type", type] }, { $not: [isCorrection] }, { $not: [isTransfer] }] }, then: "$amount" },
            ],
            default: 0
        }
    };
};

/** Amount of a transfer movement of `type` (stock that came from or went to another department). */
const transferAmount = (type: MovementType) => ({ $cond: [{ $and: [{ $eq: ["$type", type] }, isTransfer] }, "$amount", 0] });

const hasCost = { $ne: [{ $type: "$unitCost" }, "missing"] };

/**
 * Sums IN and OUT amounts, and transfers in and out, of the movements that match `createdAt`.
 * Corrections move between the columns, so `in - out` (and the balances built from it) is unchanged.
 * The OUTs are also valued: at the cost each movement kept (outValue), and the amount of the ones that kept none
 * (outWithoutCost: from before costs, valued later at the product's current cost).
 */
const sumMovements = (createdAt: Document) => [
    { $match: { createdAt } },
    {
        $group: {
            _id: null,
            in: { $sum: signedAmount("IN") },
            out: { $sum: signedAmount("OUT") },
            transferIn: { $sum: transferAmount("IN") },
            transferOut: { $sum: transferAmount("OUT") },
            outValue: { $sum: { $cond: [hasCost, { $multiply: [signedAmount("OUT"), "$unitCost"] }, 0] } },
            outWithoutCost: { $sum: { $cond: [hasCost, 0, signedAmount("OUT")] } },
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
                const none = { in: 0, out: 0, transferIn: 0, transferOut: 0, outValue: 0, outWithoutCost: 0 };
                const range = item.movements[0]?.inRange[0] || none;
                const after = item.movements[0]?.afterEnd[0] || none;
                const net = (sums: typeof none) => sums.in - sums.out + sums.transferIn - sums.transferOut;

                // Work backwards from today's quantity: undo everything that happened since the range started
                const initialQuantity = (item.quantity || 0) - net(range) - net(after);
                const finalBalance = net(range);

                return {
                    inventoryId: item._id.toString(),
                    productName: item.productName || t('unnamedProduct'),
                    sku: item.sku || "N/A",
                    initialQuantity,
                    totalIn: range.in,
                    totalOut: range.out,
                    transferIn: range.transferIn,
                    transferOut: range.transferOut,
                    unitCost: typeof item.unitCost === "number" ? item.unitCost : null,
                    // OUTs that kept no cost use the current one; without a current one either, part of it can't be valued
                    consumedValue: range.outValue + range.outWithoutCost * (item.unitCost ?? 0),
                    consumedValueIncomplete: range.outWithoutCost > 0 && typeof item.unitCost !== "number",
                    finalBalance,
                    finalQuantity: initialQuantity + finalBalance,
                };
            }),
        });
    }

    return report;
}
