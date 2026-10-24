import type { Session } from "next-auth";
import type { Document, ObjectId } from "mongodb";
import { getDb, toObjectId } from "@/lib/api";
import { MOVEMENT_REASONS, PERMISSIONS, SYSTEM_REASONS } from "@/lib/constants";
import { runnerDepartmentIds } from "@/lib/departments";
import { hasPermission } from "@/lib/permissions";
import { clampToHistory, getOrganizationPlan } from "@/lib/plans";
import { bucketCounts, fillBuckets, type Metric, type SeriesPoint } from "@/lib/series";
import { getTenantQuery } from "@/lib/tenant-guard";
import type { Department, StockItem } from "@/types/models";

/**
 * Server only: what the dashboard shows. People who see reports get the whole organization; everyone else
 * (runners) gets the departments they work in (runnerDepartmentIds).
 */

const DAY_MS = 24 * 60 * 60_000;
/** Days the stat tiles count, compared with the same number of days before */
const PERIOD_DAYS = 7;
/** Days in the movements chart */
const SERIES_DAYS = 14;
const LOW_STOCK_SHOWN = 8;
const TOP_CONSUMED_SHOWN = 5;

export type LowStockItem = {
    _id: string;
    productName: string;
    sku: string;
    quantity: number;
    minStock: number;
    unit: string;
    departmentId: string;
    departmentName: string;
};

export type ConsumedItem = { inventoryId: string; productName: string; departmentName: string; unit: string; amount: number };

export type DashboardData = {
    scope: "organization" | "assigned";
    departmentCount: number;
    productCount: number;
    lowStock: { total: number; items: LowStockItem[] };
    movements: Metric;
    activePeople: Metric;
    series: SeriesPoint[];
    topConsumed: ConsumedItem[];
};

/** The departments the dashboard covers for this user, and whether that's the whole organization. */
async function dashboardScope(session: Session) {
    const db = await getDb();
    const departments = db.collection<Department>("departments");
    if (hasPermission(session, PERMISSIONS.VIEW_REPORTS)) {
        return { scope: "organization" as const, departmentIds: await departments.find(getTenantQuery(session), { projection: { _id: 1 } }).map(d => d._id).toArray() };
    }
    // Only departments that really belong to the organization (like assignedStock in lib/departments.ts)
    const ids = await runnerDepartmentIds(session);
    const departmentIds = ids.length === 0 ? [] : await departments.find({ _id: { $in: ids }, ...getTenantQuery(session) }, { projection: { _id: 1 } }).map(d => d._id).toArray();
    return { scope: "assigned" as const, departmentIds };
}

export async function getDashboardData(session: Session): Promise<DashboardData> {
    const { scope, departmentIds } = await dashboardScope(session);
    const now = new Date();
    const periodStart = new Date(now.getTime() - PERIOD_DAYS * DAY_MS);
    const previousStart = new Date(now.getTime() - 2 * PERIOD_DAYS * DAY_MS);
    const empty: DashboardData = {
        scope, departmentCount: 0, productCount: 0, lowStock: { total: 0, items: [] },
        movements: { value: 0 }, activePeople: { value: 0 }, series: fillBuckets(new Map(), new Date(now.getTime() - (SERIES_DAYS - 1) * DAY_MS), now, "day"), topConsumed: [],
    };
    if (departmentIds.length === 0) return empty;

    // The plan's report history also limits what the dashboard looks back on
    const clientId = toObjectId(session.user.clientId);
    const plan = clientId ? await getOrganizationPlan(clientId) : null;
    const seriesStart = clampToHistory(plan, new Date(now.getTime() - (SERIES_DAYS - 1) * DAY_MS)).start;
    const comparable = !clampToHistory(plan, previousStart).limitedFrom;

    const db = await getDb();
    const stock = db.collection<StockItem>("department_stock");
    const movements = db.collection("stock_movements");
    const live = { departmentId: { $in: departmentIds }, isDeleted: { $ne: true } };
    const byPeople = { departmentId: { $in: departmentIds }, reason: { $nin: SYSTEM_REASONS } };
    const between = (start: Date, end: Date) => ({ ...byPeople, createdAt: { $gte: start, $lt: end } });

    const [productCount, [low], current, previous, people, previousPeople, counts, consumed] = await Promise.all([
        stock.countDocuments(live),
        stock.aggregate<{ total: { count: number }[]; items: StockItem[] }>([
            { $match: { ...live, $expr: { $lte: ["$quantity", "$minStock"] } } },
            // Most urgent first: the least stock for its minimum (empty products first)
            { $addFields: { ratio: { $cond: [{ $gt: ["$minStock", 0] }, { $divide: ["$quantity", "$minStock"] }, 0] } } },
            { $sort: { ratio: 1, quantity: 1, productName: 1 } },
            { $facet: { total: [{ $count: "count" }], items: [{ $limit: LOW_STOCK_SHOWN }] } },
        ]).toArray(),
        movements.countDocuments(between(periodStart, now)),
        comparable ? movements.countDocuments(between(previousStart, periodStart)) : Promise.resolve(undefined),
        countPeople(between(periodStart, now)),
        comparable ? countPeople(between(previousStart, periodStart)) : Promise.resolve(undefined),
        bucketCounts(movements, "$createdAt", between(seriesStart, now), "day"),
        consumedProducts(departmentIds, periodStart, now),
    ]);

    return {
        scope,
        departmentCount: departmentIds.length,
        productCount,
        lowStock: {
            total: low?.total[0]?.count ?? 0,
            items: (low?.items ?? []).map(item => ({
                _id: item._id.toString(),
                productName: item.productName,
                sku: item.sku,
                quantity: item.quantity,
                minStock: item.minStock,
                unit: item.unit,
                departmentId: item.departmentId.toString(),
                departmentName: item.departmentName,
            })),
        },
        movements: { value: current, previous },
        activePeople: { value: people, previous: previousPeople },
        series: fillBuckets(counts, seriesStart, now, "day"),
        topConsumed: consumed,
    };
}

/** People (by email) with movements matching `match`. An aggregation: the versioned API (apiStrict) has no distinct. */
async function countPeople(match: Document) {
    const db = await getDb();
    const [row] = await db.collection("stock_movements").aggregate<{ count: number }>([
        { $match: { ...match, "user.email": { $nin: [null, ""] } } },
        { $group: { _id: "$user.email" } },
        { $count: "count" },
    ]).toArray();
    return row?.count ?? 0;
}

/**
 * Products with the most stock used up in the period: OUT movements minus the corrections that undid one.
 * Import and reconciliation adjustments are stock counts, not use, so they don't count.
 */
async function consumedProducts(departmentIds: ObjectId[], start: Date, end: Date): Promise<ConsumedItem[]> {
    const db = await getDb();
    const rows = await db.collection("stock_movements").aggregate<{ _id: ObjectId; amount: number; productName: string; departmentName: string }>([
        { $match: { departmentId: { $in: departmentIds }, createdAt: { $gte: start, $lt: end }, reason: { $nin: [...SYSTEM_REASONS, MOVEMENT_REASONS.IMPORT] } } },
        {
            $group: {
                _id: "$inventoryId",
                amount: {
                    $sum: {
                        $switch: {
                            branches: [
                                { case: { $and: [{ $eq: ["$type", "OUT"] }, { $ne: ["$reason", MOVEMENT_REASONS.CORRECTION] }] }, then: "$amount" },
                                { case: { $and: [{ $eq: ["$type", "IN"] }, { $eq: ["$reason", MOVEMENT_REASONS.CORRECTION] }] }, then: { $multiply: ["$amount", -1] } },
                            ],
                            default: 0,
                        },
                    },
                },
                productName: { $last: "$productName" },
                departmentName: { $last: "$departmentName" },
            },
        },
        { $match: { amount: { $gt: 0 } } },
        { $sort: { amount: -1 } },
        { $limit: TOP_CONSUMED_SHOWN },
    ]).toArray();
    if (rows.length === 0) return [];

    const units = new Map((await db.collection<StockItem>("department_stock")
        .find({ _id: { $in: rows.map(r => r._id) } }, { projection: { unit: 1, productName: 1 } })
        .toArray()).map(item => [item._id.toString(), item]));
    return rows.map(row => {
        const item = units.get(row._id.toString());
        return {
            inventoryId: row._id.toString(),
            productName: item?.productName ?? row.productName,
            departmentName: row.departmentName,
            unit: item?.unit ?? "",
            amount: row.amount,
        };
    });
}
