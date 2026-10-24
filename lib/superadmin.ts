import { redirect } from "next/navigation";
import type { Collection, Document, ObjectId } from "mongodb";
import { auth } from "@/auth";
import { getDb, toObjectId } from "@/lib/api";
import type { AuditEntry } from "@/lib/audit";
import { getSuperAdminEmail, MOVEMENT_REASONS, ROLES } from "@/lib/constants";
import { timeZone } from "@/i18n/config";
import type { Membership, Organization, User } from "@/types/models";

/**
 * Server only: data for the /superadmin panel. Every page of the panel calls requireSuperadmin() first,
 * and the panel has no API routes: the data is read here and rendered on the server, so none of it
 * (nor any endpoint to fetch it) exists for other users.
 */

/**
 * The session of the superadmin; anyone else is sent to the home page, like the proxy does.
 * A redirect, not a 404: the layout calls it too, and a 404 would still render inside the panel's layout.
 */
export async function requireSuperadmin() {
    const session = await auth();
    if (session?.user?.role !== ROLES.SUPERADMIN) redirect("/");
    return session;
}

// ---------------------------------------------------------------- periods

/** Periods of the overview, as `?period=` values. Rolling windows that end now. */
export const PERIODS = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 } as const;
export type PeriodKey = keyof typeof PERIODS;
export const DEFAULT_PERIOD: PeriodKey = "7d";

export const isPeriodKey = (value: unknown): value is PeriodKey => typeof value === "string" && value in PERIODS;

export const DAY_MS = 24 * 60 * 60_000;

/** The period and the one right before it (for deltas). The 1-day period is charted by hour, the rest by day. */
export function periodRange(key: PeriodKey) {
    const end = new Date();
    const length = PERIODS[key] * DAY_MS;
    const start = new Date(end.getTime() - length);
    return { start, end, previousStart: new Date(start.getTime() - length), unit: key === "1d" ? "hour" as const : "day" as const };
}

/** Movements written by maintenance (sync, repair scripts), not by people: they don't count as activity. */
export const SYSTEM_REASONS = [MOVEMENT_REASONS.INITIAL_SYNC, MOVEMENT_REASONS.RECONCILIATION];

/** A user's creation date: createdAt, or the ObjectId's timestamp for users from before it was stored. */
export const USER_CREATED_AT = { $ifNull: ["$createdAt", { $toDate: "$_id" }] };

export const between = (field: string, start: Date, end: Date) => ({ [field]: { $gte: start, $lt: end } });

/** A user is "without organization" when no membership is active (they are in the lobby, or every org was closed). */
export const NO_ACTIVE_MEMBERSHIP = { organizations: { $not: { $elemMatch: { status: "active" } } } };

/** Excludes the superadmin's own account from user metrics. */
export function notSuperadmin() {
    const email = getSuperAdminEmail();
    return email ? { email: { $not: new RegExp(`^${escapeRegex(email)}$`, "i") } } : {};
}

export const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------------------------------------------------------------- overview

export type Metric = { value: number; previous?: number };
export type SeriesPoint = { bucket: string; value: number };

/** Everything the overview shows for one period. */
export async function getOverview(key: PeriodKey) {
    const { start, end, previousStart, unit } = periodRange(key);
    const db = await getDb();
    const users = db.collection<User>("users");
    const clients = db.collection<Organization>("clients");
    const movements = db.collection("stock_movements");
    const humanMovements = { reason: { $nin: SYSTEM_REASONS } };

    const countUsersCreated = (from: Date, to: Date) => users.countDocuments({
        ...notSuperadmin(),
        $expr: { $and: [{ $gte: [USER_CREATED_AT, from] }, { $lt: [USER_CREATED_AT, to] }] },
    });

    /** How many distinct values of `field` the people's movements in a range have. */
    const distinctInMovements = async (field: string, from: Date, to: Date) =>
        (await distinctValues(movements, field, { ...humanMovements, ...between("createdAt", from, to) })).length;

    const [
        newUsers, newUsersBefore,
        newOrganizations, newOrganizationsBefore,
        closedOrganizations, closedOrganizationsBefore,
        activeOrganizations, activeOrganizationsBefore,
        workingUsers, workingUsersBefore,
        movementCount, movementCountBefore,
        seenUsers, signIns,
        totalUsers, openOrganizations, usersWithoutOrganization, pending,
        movementSeries, signUpSeries,
    ] = await Promise.all([
        countUsersCreated(start, end), countUsersCreated(previousStart, start),
        clients.countDocuments(between("createdAt", start, end)), clients.countDocuments(between("createdAt", previousStart, start)),
        clients.countDocuments(between("closedAt", start, end)), clients.countDocuments(between("closedAt", previousStart, start)),
        distinctInMovements("clientId", start, end), distinctInMovements("clientId", previousStart, start),
        distinctInMovements("user.email", start, end), distinctInMovements("user.email", previousStart, start),
        movements.countDocuments({ ...humanMovements, ...between("createdAt", start, end) }),
        movements.countDocuments({ ...humanMovements, ...between("createdAt", previousStart, start) }),
        // lastSeenAt only keeps the latest visit, so there is no previous period to compare with
        users.countDocuments({ ...notSuperadmin(), lastSeenAt: { $gte: start } }),
        db.collection("audit_log").countDocuments({ action: "user.signIn", ...between("createdAt", start, end) }),
        users.countDocuments(notSuperadmin()),
        clients.countDocuments({ status: { $ne: "closed" } }),
        users.countDocuments({ ...notSuperadmin(), ...NO_ACTIVE_MEMBERSHIP }),
        pendingApprovals(),
        bucketCounts(movements, "$createdAt", { ...humanMovements, ...between("createdAt", start, end) }, unit),
        bucketCounts(db.collection("users"), USER_CREATED_AT, { ...notSuperadmin(), $expr: { $gte: [USER_CREATED_AT, start] } }, unit),
    ]);

    return {
        range: { start, end, unit },
        metrics: {
            seenUsers: { value: seenUsers } as Metric,
            workingUsers: { value: workingUsers, previous: workingUsersBefore },
            activeOrganizations: { value: activeOrganizations, previous: activeOrganizationsBefore },
            movements: { value: movementCount, previous: movementCountBefore },
            newUsers: { value: newUsers, previous: newUsersBefore },
            newOrganizations: { value: newOrganizations, previous: newOrganizationsBefore },
            closedOrganizations: { value: closedOrganizations, previous: closedOrganizationsBefore },
            signIns: { value: signIns } as Metric,
        },
        totals: { totalUsers, openOrganizations, usersWithoutOrganization, ...pending },
        series: {
            movements: fillBuckets(movementSeries, start, end, unit),
            signUps: fillBuckets(signUpSeries, start, end, unit),
        },
    };
}

/**
 * Distinct non-empty values of `field` among the documents that match. An aggregation, because the client
 * uses the Stable API in strict mode (lib/mongodb.ts), which doesn't include the distinct command.
 */
async function distinctValues(collection: Collection<Document>, field: string, match: Document): Promise<unknown[]> {
    const rows = await collection.aggregate([
        { $match: { ...match, [field]: { $nin: [null, ""] } } },
        { $group: { _id: `$${field}` } },
    ]).toArray();
    return rows.map(row => row._id);
}

/** Members waiting for approval, and since when the oldest one waits. */
async function pendingApprovals() {
    const db = await getDb();
    const [result] = await db.collection("users").aggregate([
        { $unwind: "$organizations" },
        { $match: { "organizations.role": ROLES.PENDING_USER } },
        { $group: { _id: null, count: { $sum: 1 }, oldest: { $min: "$organizations.joinedAt" } } },
    ]).toArray();
    return { pendingMembers: (result?.count as number) ?? 0, oldestPendingSince: (result?.oldest as Date | null) ?? null };
}

/** Documents per hour or day, keyed like fillBuckets() keys them. */
export async function bucketCounts(collection: Collection<Document>, date: unknown, match: Document, unit: "hour" | "day") {
    const rows = await collection.aggregate([
        { $match: match },
        { $group: { _id: { $dateToString: { date: { $dateTrunc: { date, unit, timezone: timeZone } }, format: BUCKET_FORMAT[unit], timezone: timeZone } }, value: { $sum: 1 } } },
    ]).toArray();
    return new Map(rows.map(row => [row._id as string, row.value as number]));
}

const BUCKET_FORMAT = { hour: "%Y-%m-%dT%H:00", day: "%Y-%m-%d" };

/** Every bucket of the range in order, with 0 where nothing happened, so the chart has no gaps. */
export function fillBuckets(counts: Map<string, number>, start: Date, end: Date, unit: "hour" | "day"): SeriesPoint[] {
    const step = unit === "hour" ? 60 * 60_000 : DAY_MS;
    const keyOf = (date: Date) => {
        const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
            timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
        }).formatToParts(date).map(p => [p.type, p.value]));
        return unit === "hour" ? `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:00` : `${parts.year}-${parts.month}-${parts.day}`;
    };

    // The first and last buckets are partial: the range starts and ends at the current time of day
    const buckets = new Set<string>();
    for (let time = start.getTime(); time < end.getTime(); time += step) buckets.add(keyOf(new Date(time)));
    buckets.add(keyOf(end));
    return [...buckets].map(bucket => ({ bucket, value: counts.get(bucket) ?? 0 }));
}

// ---------------------------------------------------------------- organizations

export const PAGE_SIZE = 25;
/** An open organization with no people's movement in this many days shows as inactive. */
export const INACTIVE_AFTER_DAYS = 30;

export type OrganizationStatus = "active" | "inactive" | "closed";
export const ORGANIZATION_FILTERS = ["all", "active", "inactive", "closed"] as const;
export type OrganizationFilter = typeof ORGANIZATION_FILTERS[number];

export type OrganizationRow = {
    _id: string;
    name: string;
    ownerEmail: string | null;
    createdAt: Date | null;
    members: number;
    pending: number;
    departments: number;
    products: number;
    lastActivity: Date | null;
    status: OrganizationStatus;
};

/** One page of the organizations registry, newest first. `q` matches the name, the owner's email or the join code. */
export async function listOrganizations({ q, filter, page }: { q?: string; filter: OrganizationFilter; page: number }) {
    const db = await getDb();
    const search = q?.trim();
    const inactiveSince = new Date(Date.now() - INACTIVE_AFTER_DAYS * DAY_MS);

    const match: Document = {};
    if (search) {
        const pattern = new RegExp(escapeRegex(search), "i");
        match.$or = [{ name: pattern }, { ownerEmail: pattern }, { clientCode: pattern }];
    }
    if (filter === "closed") match.status = "closed";
    else if (filter !== "all") {
        // "active" / "inactive" depend on the latest movement, which lives in another collection
        const recentlyActive = await distinctValues(db.collection("stock_movements"), "clientId", {
            reason: { $nin: SYSTEM_REASONS }, createdAt: { $gte: inactiveSince },
        });
        match.status = { $ne: "closed" };
        match._id = filter === "active" ? { $in: recentlyActive } : { $nin: recentlyActive };
    }

    const clients = db.collection<Organization>("clients");
    const [total, organizations] = await Promise.all([
        clients.countDocuments(match),
        clients.find(match, { projection: { name: 1, ownerEmail: 1, createdAt: 1, status: 1 } })
            .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray(),
    ]);

    const stats = await organizationStats(organizations.map(o => o._id));
    const rows: OrganizationRow[] = organizations.map(org => {
        const s = stats.get(org._id.toString());
        const lastActivity = s?.lastActivity ?? null;
        return {
            _id: org._id.toString(),
            name: org.name,
            ownerEmail: org.ownerEmail ?? null,
            createdAt: org.createdAt ?? org._id.getTimestamp(),
            members: s?.members ?? 0,
            pending: s?.pending ?? 0,
            departments: s?.departments ?? 0,
            products: s?.products ?? 0,
            lastActivity,
            status: org.status === "closed" ? "closed" : lastActivity && lastActivity >= inactiveSince ? "active" : "inactive",
        };
    });
    return { rows, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Members, pending members, departments, products and latest movement of each organization. */
export async function organizationStats(ids: ObjectId[]) {
    const stats = new Map<string, { members: number; pending: number; departments: number; products: number; lastActivity: Date | null }>();
    if (ids.length === 0) return stats;
    const db = await getDb();
    const entry = (id: string) => {
        if (!stats.has(id)) stats.set(id, { members: 0, pending: 0, departments: 0, products: 0, lastActivity: null });
        return stats.get(id)!;
    };
    // Memberships migrated from the old top-level clientId may store it as a string
    const anyIdForm = [...ids, ...ids.map(String)];

    const [memberships, departments, activity] = await Promise.all([
        db.collection("users").aggregate([
            { $unwind: "$organizations" },
            { $match: { "organizations.clientId": { $in: anyIdForm } } },
            {
                $group: {
                    _id: { $toString: "$organizations.clientId" },
                    members: { $sum: { $cond: [{ $and: [{ $eq: ["$organizations.status", "active"] }, { $ne: ["$organizations.role", ROLES.PENDING_USER] }] }, 1, 0] } },
                    pending: { $sum: { $cond: [{ $eq: ["$organizations.role", ROLES.PENDING_USER] }, 1, 0] } },
                },
            },
        ]).toArray(),
        db.collection("departments").find({ clientId: { $in: ids } }, { projection: { clientId: 1 } }).toArray(),
        db.collection("stock_movements").aggregate([
            { $match: { clientId: { $in: ids }, reason: { $nin: SYSTEM_REASONS } } },
            { $group: { _id: "$clientId", last: { $max: "$createdAt" } } },
        ]).toArray(),
    ]);

    for (const m of memberships) Object.assign(entry(m._id), { members: m.members, pending: m.pending });
    for (const a of activity) entry(a._id.toString()).lastActivity = a.last;

    // department_stock has no clientId: count products per department, then add them up per organization
    const clientOfDepartment = new Map(departments.map(d => [d._id.toString(), d.clientId.toString()]));
    for (const d of departments) entry(d.clientId.toString()).departments++;
    if (departments.length > 0) {
        const products = await db.collection("department_stock").aggregate([
            { $match: { departmentId: { $in: departments.map(d => d._id) }, isDeleted: { $ne: true } } },
            { $group: { _id: "$departmentId", count: { $sum: 1 } } },
        ]).toArray();
        for (const p of products) {
            const clientId = clientOfDepartment.get(p._id.toString());
            if (clientId) entry(clientId).products += p.count;
        }
    }
    return stats;
}

/** One organization with its members, departments, 30-day activity and audit entries. Null when it doesn't exist. */
export async function getOrganizationDetail(id: string) {
    const _id = toObjectId(id);
    if (!_id) return null;
    const db = await getDb();
    const organization = await db.collection<Organization>("clients").findOne({ _id });
    if (!organization) return null;

    const anyIdForm = { $in: [_id, _id.toString()] };
    const since = new Date(Date.now() - 30 * DAY_MS);
    const [plan, memberDocs, departments, stats, activitySeries, audit] = await Promise.all([
        organization.planId ? db.collection("plans").findOne({ _id: organization.planId }, { projection: { name: 1 } }) : null,
        db.collection<User>("users").find({ "organizations.clientId": anyIdForm } as object, {
            projection: { name: 1, email: 1, isActive: 1, lastSeenAt: 1, organizations: 1 },
        }).toArray(),
        db.collection("departments").find({ clientId: _id }, { projection: { name: 1, createdAt: 1 } }).sort({ name: 1 }).toArray(),
        organizationStats([_id]),
        bucketCounts(db.collection("stock_movements"), "$createdAt", { clientId: _id, reason: { $nin: SYSTEM_REASONS }, createdAt: { $gte: since } }, "day"),
        listAudit({ clientId: _id, page: 1 }),
    ]);

    const productCounts = new Map((await db.collection("department_stock").aggregate([
        { $match: { departmentId: { $in: departments.map(d => d._id) }, isDeleted: { $ne: true } } },
        { $group: { _id: "$departmentId", count: { $sum: 1 } } },
    ]).toArray()).map(p => [p._id.toString(), p.count as number]));

    const members = memberDocs.map(user => {
        const membership = user.organizations.find(m => m.clientId.toString() === id) as Membership | undefined;
        return {
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: membership?.role ?? ROLES.NEW_USER,
            status: membership?.status ?? "inactive",
            joinedAt: membership?.joinedAt ?? null,
            lastSeenAt: (user as User & { lastSeenAt?: Date }).lastSeenAt ?? null,
            isOwner: !!organization.ownerEmail && organization.ownerEmail.toLowerCase() === user.email?.toLowerCase(),
        };
    }).sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || (a.name || "").localeCompare(b.name || ""));

    return {
        organization: {
            _id: organization._id.toString(),
            name: organization.name,
            clientCode: organization.clientCode,
            ownerEmail: organization.ownerEmail ?? null,
            planName: (plan?.name as string | undefined) ?? null,
            /** The assigned plan (clients.planId). A trial or subscription may give another one: see getPlanUsage */
            planId: organization.planId?.toString() ?? null,
            createdAt: organization.createdAt ?? organization._id.getTimestamp(),
            status: organization.status === "closed" ? "closed" as const : "open" as const,
            closedAt: organization.closedAt ?? null,
            closedBy: organization.closedBy ?? null,
            /** Memberships saved when it was closed (null: closed before they were saved, only the owner can come back) */
            closedMemberships: organization.closedMemberships ? organization.closedMemberships.length : null,
            lastActivity: stats.get(id)?.lastActivity ?? null,
        },
        members,
        departments: departments.map(d => ({ _id: d._id.toString(), name: d.name as string, products: productCounts.get(d._id.toString()) ?? 0 })),
        activity: fillBuckets(activitySeries, since, new Date(), "day"),
        audit: audit.rows,
    };
}

// ---------------------------------------------------------------- users

export const USER_FILTERS = ["all", "noOrganization", "pending", "disabled"] as const;
export type UserFilter = typeof USER_FILTERS[number];

export type UserRow = {
    _id: string;
    name: string;
    email: string;
    createdAt: Date;
    lastSeenAt: Date | null;
    isActive: boolean;
    organizations: { clientId: string; name: string; role: string; status: string }[];
};

type UserDoc = User & { createdAt?: Date; lastSeenAt?: Date; lastLoginAt?: Date };

/** One page of the users registry, newest first. `q` matches the name or email. The superadmin isn't listed. */
export async function listUsers({ q, filter, page }: { q?: string; filter: UserFilter; page: number }) {
    const db = await getDb();
    const search = q?.trim();
    const match: Document = { ...notSuperadmin() };
    if (search) {
        const pattern = new RegExp(escapeRegex(search), "i");
        match.$or = [{ name: pattern }, { email: pattern }];
    }
    if (filter === "noOrganization") Object.assign(match, NO_ACTIVE_MEMBERSHIP);
    if (filter === "pending") match["organizations.role"] = ROLES.PENDING_USER;
    if (filter === "disabled") match.isActive = false;

    const users = db.collection<UserDoc>("users");
    const [total, docs] = await Promise.all([
        users.countDocuments(match),
        users.find(match, { projection: { name: 1, email: 1, isActive: 1, createdAt: 1, lastSeenAt: 1, organizations: 1 } })
            .sort({ _id: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray(),
    ]);

    const names = await organizationNames(docs.flatMap(u => (u.organizations || []).map(m => m.clientId)));
    const rows: UserRow[] = docs.map(user => ({
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        createdAt: user.createdAt ?? user._id.getTimestamp(),
        lastSeenAt: user.lastSeenAt ?? null,
        isActive: user.isActive !== false,
        organizations: membershipsOf(user, names),
    }));
    return { rows, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Names of organizations by id. Memberships store a copy of the name, but it goes stale when it is renamed. */
export async function organizationNames(ids: unknown[]) {
    const objectIds = [...new Set(ids.map(String))].map(toObjectId).filter((id): id is ObjectId => id !== null);
    if (objectIds.length === 0) return new Map<string, string>();
    const db = await getDb();
    const docs = await db.collection("clients").find({ _id: { $in: objectIds } }, { projection: { name: 1 } }).toArray();
    return new Map(docs.map(d => [d._id.toString(), d.name as string]));
}

function membershipsOf(user: User, names: Map<string, string>) {
    return (user.organizations || [])
        .filter(m => toObjectId(m.clientId.toString())) // Skips the old "sup22" placeholder
        .map(m => ({
            clientId: m.clientId.toString(),
            name: names.get(m.clientId.toString()) ?? m.clientName ?? "",
            role: m.role,
            status: m.status,
        }));
}

/** One user with their memberships, recent work and audit entries. Null when they don't exist. */
export async function getUserDetail(id: string) {
    const _id = toObjectId(id);
    if (!_id) return null;
    const db = await getDb();
    const user = await db.collection<UserDoc>("users").findOne({ _id, ...notSuperadmin() }, {
        projection: { name: 1, email: 1, image: 1, isActive: 1, createdAt: 1, lastSeenAt: 1, lastLoginAt: 1, organizations: 1, activeOrganization: 1 },
    });
    if (!user) return null;

    const since = new Date(Date.now() - 30 * DAY_MS);
    const [names, movements30d, audit] = await Promise.all([
        organizationNames((user.organizations || []).map(m => m.clientId)),
        db.collection("stock_movements").countDocuments({ "user.email": user.email, reason: { $nin: SYSTEM_REASONS }, createdAt: { $gte: since } }),
        listAudit({ userId: _id, email: user.email, page: 1 }),
    ]);

    return {
        user: {
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
            isActive: user.isActive !== false,
            createdAt: user.createdAt ?? user._id.getTimestamp(),
            lastSeenAt: user.lastSeenAt ?? null,
            lastLoginAt: user.lastLoginAt ?? null,
            activeOrganization: user.activeOrganization?.toString() ?? null,
        },
        memberships: (user.organizations || []).filter(m => toObjectId(m.clientId.toString())).map(m => ({
            clientId: m.clientId.toString(),
            name: names.get(m.clientId.toString()) ?? m.clientName ?? "",
            role: m.role,
            status: m.status,
            joinedAt: m.joinedAt ?? null,
            departments: m.departments?.length ?? 0,
        })),
        movements30d,
        audit: audit.rows,
    };
}

// ---------------------------------------------------------------- audit

export type AuditRow = {
    _id: string;
    action: string;
    actor: { email: string | null; name: string | null };
    organization: { _id: string; name: string } | null;
    target: { type: string; id: string | null; label: string | null } | null;
    details: Record<string, unknown> | null;
    createdAt: Date;
};

/**
 * One page of audit entries, newest first.
 * Filters: an action, an organization, or a user (entries they made or that were done to them).
 */
export async function listAudit({ action, clientId, userId, email, q, page }: {
    action?: string; clientId?: ObjectId; userId?: ObjectId; email?: string; q?: string; page: number;
}) {
    const db = await getDb();
    const match: Document = {};
    if (action) match.action = action;
    if (clientId) match.clientId = clientId;
    if (userId || email) match.$or = [{ "actor.email": email }, { "actor.id": userId }, { "target.id": userId }].filter(c => Object.values(c)[0]);
    if (q?.trim()) {
        const pattern = new RegExp(escapeRegex(q.trim()), "i");
        match.$and = [{ $or: [{ "actor.email": pattern }, { "actor.name": pattern }, { "target.label": pattern }] }];
    }

    const log = db.collection<AuditEntry>("audit_log");
    const [total, entries] = await Promise.all([
        log.countDocuments(match),
        log.find(match).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE * 2).limit(PAGE_SIZE * 2).toArray(),
    ]);
    const names = await organizationNames(entries.map(e => e.clientId).filter(Boolean));

    const rows: AuditRow[] = entries.map(e => ({
        _id: e._id.toString(),
        action: e.action,
        actor: { email: e.actor?.email ?? null, name: e.actor?.name ?? null },
        organization: e.clientId ? { _id: e.clientId.toString(), name: names.get(e.clientId.toString()) ?? "" } : null,
        target: e.target ? { type: e.target.type, id: e.target.id?.toString() ?? null, label: e.target.label ?? null } : null,
        details: e.details ?? null,
        createdAt: e.createdAt,
    }));
    return { rows, total, pages: Math.max(1, Math.ceil(total / (PAGE_SIZE * 2))) };
}

/** `?page=` as a page number (1 when missing or invalid). */
export const pageOf = (value: unknown) => Math.max(1, Math.floor(Number(value)) || 1);
