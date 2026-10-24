import type { Document } from "mongodb";
import { getDb, toObjectId } from "@/lib/api";
import { dayKey } from "@/lib/activity";
import { getSuperAdminEmail, PLACEHOLDER_CLIENT_ID, ROLES } from "@/lib/constants";
import { getRolePermissions } from "@/lib/roles";
import {
    DAY_MS, escapeRegex, listOrganizations, NO_ACTIVE_MEMBERSHIP, notSuperadmin, organizationNames,
    organizationStats, periodRange, USER_CREATED_AT, type PeriodKey, type SeriesPoint,
} from "@/lib/superadmin";
import type { Department, Organization, User } from "@/types/models";

/**
 * Server only: the superadmin panel's insights (active users, onboarding funnel, health alerts, access
 * diagnosis). Like lib/superadmin.ts, read by the panel's server components after requireSuperadmin().
 */

// ---------------------------------------------------------------- active users

/** Daily, weekly and monthly active users (people who opened the app), from user_activity (lib/activity.ts). */
export async function getActiveUsers() {
    const db = await getDb();
    const now = Date.now();
    const days = Array.from({ length: 30 }, (_, i) => dayKey(new Date(now - (29 - i) * DAY_MS)));
    const superadminEmail = getSuperAdminEmail();
    const people = superadminEmail ? { email: { $ne: superadminEmail } } : {};

    const distinctSince = async (firstDay: string) => {
        const [row] = await db.collection("user_activity").aggregate([
            { $match: { ...people, day: { $gte: firstDay } } },
            { $group: { _id: "$email" } },
            { $count: "users" },
        ]).toArray();
        return (row?.users as number) ?? 0;
    };

    const [perDay, wau, mau, first] = await Promise.all([
        db.collection("user_activity").aggregate([
            { $match: { ...people, day: { $gte: days[0] } } },
            { $group: { _id: "$day", users: { $sum: 1 } } },
        ]).toArray(),
        distinctSince(days[days.length - 7]),
        distinctSince(days[0]),
        db.collection("user_activity").find({}, { projection: { day: 1 } }).sort({ day: 1 }).limit(1).next(),
    ]);

    const counts = new Map(perDay.map(row => [row._id as string, row.users as number]));
    const series: SeriesPoint[] = days.map(day => ({ bucket: day, value: counts.get(day) ?? 0 }));
    // Average daily users over the days that were tracked, against the monthly ones: how often people come back
    const trackedDays = first ? series.filter(p => p.bucket >= (first.day as string)) : [];
    const averageDau = trackedDays.length ? trackedDays.reduce((sum, p) => sum + p.value, 0) / trackedDays.length : 0;

    return {
        dau: counts.get(days[days.length - 1]) ?? 0,
        wau,
        mau,
        stickiness: mau ? averageDau / mau : null,
        series,
        trackingSince: (first?.day as string | undefined) ?? null,
    };
}

// ---------------------------------------------------------------- onboarding funnel

export const FUNNEL_STEPS = ["registered", "joined", "approved", "working"] as const;
export type FunnelStep = typeof FUNNEL_STEPS[number];

/**
 * Of the users who registered in the period: how many then created or joined an organization, were approved
 * (or own one), and recorded their first stock movement. Shows where new people get stuck.
 */
export async function getFunnel(key: PeriodKey): Promise<Record<FunnelStep, number>> {
    const { start, end } = periodRange(key);
    const db = await getDb();
    // Memberships without the old "sup22" placeholder
    const realMemberships = {
        $filter: { input: { $ifNull: ["$organizations", []] }, cond: { $ne: [{ $toString: "$$this.clientId" }, PLACEHOLDER_CLIENT_ID] } },
    };

    const [row] = await db.collection("users").aggregate([
        { $match: { ...notSuperadmin(), $expr: { $and: [{ $gte: [USER_CREATED_AT, start] }, { $lt: [USER_CREATED_AT, end] }] } } },
        { $project: { email: 1, memberships: realMemberships } },
        // Owners keep owning a closed organization, but closing it removed their membership
        { $lookup: { from: "clients", localField: "email", foreignField: "ownerEmail", as: "owned", pipeline: [{ $project: { _id: 1 } }] } },
        {
            $lookup: {
                from: "stock_movements", let: { email: "$email" }, as: "movement",
                pipeline: [{ $match: { $expr: { $eq: ["$user.email", "$$email"] } } }, { $limit: 1 }, { $project: { _id: 1 } }],
            },
        },
        {
            $project: {
                owns: { $gt: [{ $size: "$owned" }, 0] },
                joined: { $gt: [{ $size: "$memberships" }, 0] },
                approved: {
                    $anyElementTrue: [{ $map: { input: "$memberships", in: { $and: [{ $eq: ["$$this.status", "active"] }, { $ne: ["$$this.role", ROLES.PENDING_USER] }] } } }],
                },
                working: { $gt: [{ $size: "$movement" }, 0] },
            },
        },
        {
            $group: {
                _id: null,
                registered: { $sum: 1 },
                joined: { $sum: { $cond: [{ $or: ["$joined", "$owns"] }, 1, 0] } },
                approved: { $sum: { $cond: [{ $or: ["$approved", "$owns"] }, 1, 0] } },
                working: { $sum: { $cond: ["$working", 1, 0] } },
            },
        },
    ]).toArray();

    return { registered: row?.registered ?? 0, joined: row?.joined ?? 0, approved: row?.approved ?? 0, working: row?.working ?? 0 };
}

// ---------------------------------------------------------------- health

/** Thresholds of the health alerts, in days. */
export const HEALTH_THRESHOLDS = { pendingDays: 3, lobbyDays: 2, newOrganizationDays: 7 } as const;
const ALERT_LIMIT = 50;

/**
 * Lists of where people may need help: organizations that stopped working or never started, members waiting
 * for approval, users stuck without an organization, and stock items whose quantity doesn't match their movements.
 */
export async function getHealth() {
    const db = await getDb();
    const now = Date.now();
    const daysAgo = (days: number) => new Date(now - days * DAY_MS);

    const [inactive, pendingRows, lobbyUsers, youngOrgsCutoff, stockMismatches] = await Promise.all([
        listOrganizations({ filter: "inactive", page: 1 }),
        db.collection<User>("users").aggregate([
            { $match: notSuperadmin() },
            { $unwind: "$organizations" },
            { $match: { "organizations.role": ROLES.PENDING_USER, "organizations.joinedAt": { $lt: daysAgo(HEALTH_THRESHOLDS.pendingDays) } } },
            { $sort: { "organizations.joinedAt": 1 } },
            { $limit: ALERT_LIMIT },
            { $project: { name: 1, email: 1, clientId: "$organizations.clientId", since: "$organizations.joinedAt" } },
        ]).toArray(),
        db.collection<User>("users").find({
            ...notSuperadmin(), ...NO_ACTIVE_MEMBERSHIP,
            $expr: { $lt: [USER_CREATED_AT, daysAgo(HEALTH_THRESHOLDS.lobbyDays)] },
        } as Document, { projection: { name: 1, email: 1, createdAt: 1 } }).sort({ _id: 1 }).limit(ALERT_LIMIT).toArray(),
        // Organizations old enough to expect members and products
        db.collection<Organization>("clients").find({
            status: { $ne: "closed" }, createdAt: { $lt: daysAgo(HEALTH_THRESHOLDS.newOrganizationDays) },
        }, { projection: { name: 1, ownerEmail: 1, createdAt: 1 } }).sort({ createdAt: 1 }).limit(500).toArray(),
        stockMismatchList(),
    ]);

    const [names, stats] = await Promise.all([
        organizationNames(pendingRows.map(r => r.clientId)),
        organizationStats(youngOrgsCutoff.map(o => o._id)),
    ]);
    const settled = youngOrgsCutoff.map(org => ({
        _id: org._id.toString(), name: org.name, ownerEmail: org.ownerEmail ?? null, createdAt: org.createdAt,
        members: stats.get(org._id.toString())?.members ?? 0, products: stats.get(org._id.toString())?.products ?? 0,
    }));

    return {
        inactiveOrganizations: { total: inactive.total, rows: inactive.rows.map(r => ({ _id: r._id, name: r.name, ownerEmail: r.ownerEmail, lastActivity: r.lastActivity, createdAt: r.createdAt })) },
        longPending: pendingRows.map(r => ({
            userId: r._id.toString(), name: r.name as string, email: r.email as string,
            clientId: r.clientId.toString(), organization: names.get(r.clientId.toString()) ?? "", since: r.since as Date,
        })),
        lobbyUsers: lobbyUsers.map(u => ({ _id: u._id.toString(), name: u.name, email: u.email, createdAt: (u as User & { createdAt?: Date }).createdAt ?? u._id.getTimestamp() })),
        loneOrganizations: settled.filter(o => o.members <= 1),
        emptyOrganizations: settled.filter(o => o.products === 0),
        stockMismatches,
    };
}

/**
 * Stock items whose quantity isn't the sum of their movements (the check of /api/admin/reports/sync, read-only).
 * They mean a change that wasn't recorded, and make the reports wrong.
 */
async function stockMismatchList() {
    const db = await getDb();
    const rows = await db.collection("stock_movements").aggregate([
        {
            $group: {
                _id: "$inventoryId",
                calculated: { $sum: { $cond: [{ $eq: ["$type", "IN"] }, "$amount", { $multiply: ["$amount", -1] }] } },
            },
        },
        { $lookup: { from: "department_stock", localField: "_id", foreignField: "_id", as: "item" } },
        { $unwind: "$item" },
        { $match: { "item.isDeleted": { $ne: true }, $expr: { $ne: ["$item.quantity", "$calculated"] } } },
        { $lookup: { from: "departments", localField: "item.departmentId", foreignField: "_id", as: "department" } },
        { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } },
        { $limit: ALERT_LIMIT },
        {
            $project: {
                productName: "$item.productName", sku: "$item.sku", quantity: "$item.quantity", calculated: 1,
                departmentName: "$department.name", clientId: "$department.clientId",
            },
        },
    ]).toArray();
    const names = await organizationNames(rows.map(r => r.clientId).filter(Boolean));
    return rows.map(r => ({
        _id: r._id.toString(), productName: r.productName as string, sku: r.sku as string,
        quantity: r.quantity as number, calculated: r.calculated as number, departmentName: (r.departmentName as string) ?? "",
        clientId: r.clientId?.toString() ?? null, organization: r.clientId ? names.get(r.clientId.toString()) ?? "" : "",
    }));
}

/** How many alerts each health list has, for the overview. */
export async function getHealthCounts() {
    const health = await getHealth();
    return {
        inactiveOrganizations: health.inactiveOrganizations.total,
        longPending: health.longPending.length,
        lobbyUsers: health.lobbyUsers.length,
        loneOrganizations: health.loneOrganizations.length,
        emptyOrganizations: health.emptyOrganizations.length,
        stockMismatches: health.stockMismatches.length,
    };
}

// ---------------------------------------------------------------- access diagnosis

/** Where a user ends up when they open the app, and why. Codes are labeled by the "superadmin.diagnosis" messages. */
export type AccessState = "accountDisabled" | "lobby" | "allInactive" | "pendingApproval" | "member";

export type DiagnosisNote =
    | "savedOrganizationNotUsed" | "departmentOtherOrganization" | "departmentMissing" | "noDepartments"
    | "organizationClosed" | "placeholderMembership" | "superadminRoleIgnored";

/**
 * Replays how the session resolves this user (resolveContext in auth.ts) without signing in as them:
 * which organization and role they get, their permissions and departments, and anything that looks wrong.
 */
export async function getAccessDiagnosis(id: string) {
    const _id = toObjectId(id);
    if (!_id) return null;
    const db = await getDb();
    const user = await db.collection<User>("users").findOne({ _id, ...notSuperadmin() });
    if (!user) return null;

    const notes: DiagnosisNote[] = [];
    const all = user.organizations || [];
    if (all.some(m => m.clientId?.toString() === PLACEHOLDER_CLIENT_ID)) notes.push("placeholderMembership");
    const memberships = all.filter(m => m.clientId && m.clientId.toString() !== PLACEHOLDER_CLIENT_ID);
    const active = memberships.filter(m => m.status === "active");
    const savedId = user.activeOrganization?.toString();
    const membership = active.find(m => m.clientId.toString() === savedId) || active[0];

    const state: AccessState =
        user.isActive === false ? "accountDisabled"
            : !membership ? (memberships.length === 0 ? "lobby" : "allInactive")
                : membership.role === ROLES.PENDING_USER ? "pendingApproval"
                    : "member";

    if (savedId && membership && membership.clientId.toString() !== savedId) notes.push("savedOrganizationNotUsed");
    if (!membership || state === "accountDisabled") {
        return { state, organization: null, role: null, permissions: [], departments: [], notes };
    }

    let role = membership.role;
    if (role === ROLES.SUPERADMIN) {
        notes.push("superadminRoleIgnored");
        role = ROLES.USER;
    }

    const clientId = toObjectId(membership.clientId.toString())!;
    const departmentIds = (membership.departments || []).map(d => toObjectId(d.toString())).filter(d => d !== null);
    const [organization, permissions, departments] = await Promise.all([
        db.collection<Organization>("clients").findOne({ _id: clientId }, { projection: { name: 1, status: 1 } }),
        getRolePermissions(role),
        db.collection<Department>("departments").find({ _id: { $in: departmentIds } }, { projection: { name: 1, clientId: 1 } }).toArray(),
    ]);
    if (organization?.status === "closed") notes.push("organizationClosed");

    const byId = new Map(departments.map(d => [d._id.toString(), d]));
    const departmentRows = departmentIds.map(depId => {
        const dept = byId.get(depId.toString());
        const status = !dept ? "missing" as const : dept.clientId.toString() === clientId.toString() ? "ok" as const : "otherOrganization" as const;
        if (status === "missing") notes.push("departmentMissing");
        if (status === "otherOrganization") notes.push("departmentOtherOrganization");
        return { _id: depId.toString(), name: dept?.name ?? "", status };
    });
    if (state === "member" && role === ROLES.USER && departmentRows.filter(d => d.status === "ok").length === 0) notes.push("noDepartments");

    return {
        state,
        organization: { _id: clientId.toString(), name: organization?.name ?? membership.clientName ?? "" },
        role,
        permissions: Object.entries(permissions).filter(([, granted]) => granted).map(([key]) => key),
        departments: departmentRows,
        notes: [...new Set(notes)],
    };
}

// ---------------------------------------------------------------- search

/** Users and organizations matching a text: email, name, or an organization's join code. */
export async function universalSearch(q: string) {
    const text = q.trim();
    if (!text) return { users: [], organizations: [] };
    const db = await getDb();
    const pattern = new RegExp(escapeRegex(text), "i");
    // A join code typed without its dash still finds the organization
    const code = text.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const codePatterns = code.length >= 6 ? [`${code.slice(0, 4)}-${code.slice(4)}`, `${code.slice(0, 3)}-${code.slice(3)}`] : [];

    const [users, organizations] = await Promise.all([
        db.collection<User>("users").find({ ...notSuperadmin(), $or: [{ name: pattern }, { email: pattern }] }, { projection: { name: 1, email: 1 } }).limit(10).toArray(),
        db.collection<Organization>("clients").find({
            $or: [{ name: pattern }, { ownerEmail: pattern }, { clientCode: pattern }, ...(codePatterns.length ? [{ clientCode: { $in: codePatterns } }] : [])],
        }, { projection: { name: 1, ownerEmail: 1, status: 1, clientCode: 1 } }).limit(10).toArray(),
    ]);

    return {
        users: users.map(u => ({ _id: u._id.toString(), name: u.name, email: u.email })),
        organizations: organizations.map(o => ({ _id: o._id.toString(), name: o.name, ownerEmail: o.ownerEmail ?? null, closed: o.status === "closed" })),
    };
}
