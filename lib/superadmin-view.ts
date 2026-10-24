import type { ObjectId } from "mongodb";
import type { Session } from "next-auth";
import { getDb } from "@/lib/api";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { timeZone } from "@/i18n/config";
import { dayKey } from "@/lib/activity";
import type { Department, StockItem, StockMovement } from "@/types/models";

/**
 * Server only: data of the superadmin's read-only view of an organization ("view as"): what its admin sees
 * in inventory, movements and reports. Only reads; the page that shows it has no forms or client-side calls.
 */

/** Departments of the organization with their products (deleted ones left out), sorted by name. */
export async function getOrganizationInventory(clientId: ObjectId) {
    const db = await getDb();
    const departments = await db.collection<Department>("departments").find({ clientId }, { projection: { name: 1 } }).sort({ name: 1 }).toArray();
    const items = departments.length === 0 ? [] : await db.collection<StockItem>("department_stock")
        .find({ departmentId: { $in: departments.map(d => d._id) }, isDeleted: { $ne: true } },
            { projection: { departmentId: 1, productName: 1, sku: 1, unit: 1, quantity: 1, minStock: 1, updatedAt: 1 } })
        .sort({ productName: 1 })
        .toArray();

    return departments.map(dept => ({
        _id: dept._id.toString(),
        name: dept.name,
        items: items.filter(item => item.departmentId.equals(dept._id)).map(item => ({
            _id: item._id.toString(),
            productName: item.productName,
            sku: item.sku,
            unit: item.unit,
            quantity: Number(item.quantity) || 0,
            minStock: Number(item.minStock) || 0,
            low: (Number(item.quantity) || 0) <= (Number(item.minStock) || 0),
            updatedAt: item.updatedAt ?? null,
        })),
    }));
}

/** The organization's latest stock movements, newest first. */
export async function getRecentMovements(clientId: ObjectId, limit = 100) {
    const db = await getDb();
    const movements = await db.collection<StockMovement>("stock_movements")
        .find({ clientId }, { projection: { productName: 1, sku: 1, departmentName: 1, type: 1, amount: 1, newBalance: 1, reason: 1, user: 1, createdAt: 1 } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

    return movements.map(m => ({
        _id: m._id.toString(),
        productName: m.productName,
        sku: m.sku,
        departmentName: m.departmentName,
        type: m.type,
        amount: m.amount,
        newBalance: typeof m.newBalance === "number" ? m.newBalance : null,
        reason: m.reason,
        userName: m.user?.name ?? m.user?.email ?? null,
        createdAt: m.createdAt,
    }));
}

/** How long one "view as" audit entry covers, so browsing the tabs doesn't flood the log. */
const VIEW_LOG_WINDOW_MS = 30 * 60_000;

/**
 * Records that the superadmin looked at the organization's data, at most once per VIEW_LOG_WINDOW_MS:
 * reading a customer's data is something they can ask about later.
 */
export async function logViewAs(session: Session, clientId: ObjectId, label: string) {
    const db = await getDb();
    const recent = await db.collection("audit_log").findOne({
        action: AUDIT_ACTIONS.VIEW_AS, clientId, "actor.email": session.user.email, createdAt: { $gte: new Date(Date.now() - VIEW_LOG_WINDOW_MS) },
    }, { projection: { _id: 1 } });
    if (recent) return;
    await logAudit(AUDIT_ACTIONS.VIEW_AS, { actor: session.user, clientId, target: { type: "organization", id: clientId, label } });
}

/** "YYYY-MM-DD" → the first or last millisecond of that day in the app's time zone. */
export function zonedDayBoundary(day: string, edge: "start" | "end"): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    const utcMidnight = new Date(`${day}T00:00:00Z`);
    if (Number.isNaN(utcMidnight.getTime())) return null;
    // Offset of the time zone on that day, e.g. "GMT-06:00"
    const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
        .formatToParts(utcMidnight).find(p => p.type === "timeZoneName")?.value ?? "GMT";
    const match = name.match(/GMT([+-])(\d{2}):(\d{2})/);
    const offsetMs = match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) * 60_000 : 0;
    const start = new Date(utcMidnight.getTime() - offsetMs);
    return edge === "start" ? start : new Date(start.getTime() + 24 * 60 * 60_000 - 1);
}

/** The report's days from ?start=&end= ("YYYY-MM-DD"), or the last 30 days when missing or invalid. */
export function reportRange(start?: string, end?: string) {
    const now = Date.now();
    return {
        startDay: start && zonedDayBoundary(start, "start") ? start : dayKey(new Date(now - 29 * 24 * 60 * 60_000)),
        endDay: end && zonedDayBoundary(end, "end") ? end : dayKey(new Date(now)),
    };
}
