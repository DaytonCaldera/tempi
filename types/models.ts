import type { ObjectId } from "mongodb";

/**
 * Shapes of the documents stored in MongoDB.
 * `Id` is ObjectId for documents read from the DB, and string once they are serialized
 * for the client or stored in the session.
 */

export type MovementType = "IN" | "OUT";

/** A user's membership in one organization (an entry of `users.organizations`). */
export interface Membership<Id = ObjectId> {
    clientId: Id;
    clientName?: string;
    clientCode?: string;
    role: string; // "admin", "user", "pending_user", ... see ROLES
    status: "active" | "inactive" | "pending" | "suspended";
    departments?: Id[];
    joinedAt?: Date;
}

/** Membership as stored in the session/JWT, with ids as strings. */
export type SessionMembership = Membership<string>;

/** Page a user lands on after signing in. Missing until a runner answers the prompt on the dashboard. */
export type StartPage = "runner" | "dashboard";

export interface User {
    _id: ObjectId;
    name: string;
    email: string;
    image?: string;
    isActive: boolean;
    organizations: Membership[];
    activeOrganization?: ObjectId | null;
    startPage?: StartPage;
}

/** An organization. Stored in the "clients" collection. */
export interface Organization {
    _id: ObjectId;
    name: string;
    clientCode: string;
    planId: ObjectId;
    ownerEmail: string;
    createdAt: Date;
    /** Missing on organizations created before it existed, which are open. See closeOrganization. */
    status?: "active" | "closed";
    closedAt?: Date;
    closedBy?: string; // Email of who closed it
    /** Memberships it had when it was closed, for restoring it (see closeOrganization). Missing on older closures */
    closedMemberships?: { userId: ObjectId; membership: Membership }[];
    reopenedAt?: Date;
    reopenedBy?: string;
    /** Paid subscription, written only by the billing webhook (app/api/billing/webhook) */
    subscription?: Subscription;
    /** Free time on another plan (e.g. Pro for the organizations that existed before paid plans). See lib/plans.ts */
    trial?: { planId: ObjectId; endsAt: Date };
}

/** Lemon Squeezy subscription statuses (https://docs.lemonsqueezy.com/api/subscriptions). */
export type SubscriptionStatus = "on_trial" | "active" | "paused" | "past_due" | "unpaid" | "cancelled" | "expired";

export interface Subscription {
    provider: "lemonsqueezy";
    id: string;
    status: SubscriptionStatus;
    planId: ObjectId;
    variantId?: string;
    /** Next charge. Missing once it is cancelled */
    renewsAt?: Date | null;
    /** When a cancelled subscription stops giving access */
    endsAt?: Date | null;
    /** When it went past_due, for the grace period */
    pastDueSince?: Date | null;
    portalUrl?: string;
    updatedAt: Date;
}

/** Plans of the public catalog. Custom plans (isCustom) have no key. */
export type PlanKey = "free" | "pro" | "business";

export interface Plan {
    _id: ObjectId;
    /** Stable id of a catalog plan; name is only what is shown */
    key?: PlanKey;
    name: string;
    /** USD per month */
    price: number;
    /** USD per year (0 or missing: no yearly billing) */
    priceYearly?: number;
    // 0 or missing means unlimited (see lib/plans.ts)
    maxDepartments: number;
    maxUsers: number;
    maxItems: number;
    /** How many days back reports and movement details can look. 0 or missing: all of it */
    historyDays?: number;
    /** Keys of PLAN_FEATURES */
    features: string[];
    isActive: boolean;
    /** A plan made by the superadmin for one organization (clientId). Never listed publicly */
    isCustom?: boolean;
    clientId?: ObjectId;
    notes?: string;
    /** How the plan is paid. "manual": invoiced by Vitalliz, the superadmin assigns it */
    billingMode?: "lemonsqueezy" | "manual";
    /** Lemon Squeezy variants of a catalog plan */
    billing?: { monthlyVariantId?: string; yearlyVariantId?: string };
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Department<Id = ObjectId> {
    _id: Id;
    name: string;
    description?: string;
    clientId: Id;
    createdAt: Date;
}

/** A product in a department's inventory ("department_stock" collection). */
export interface StockItem<Id = ObjectId> {
    _id: Id;
    departmentId: Id;
    departmentName: string;
    /** Missing on products created before it was stored: scripts/backfill-stock-fields.js fills it in */
    clientId?: Id;
    productName: string;
    /** Unique among the department's products that aren't deleted */
    sku: string;
    unit: string;
    category?: string;
    quantity: number;
    minStock: number;
    isDeleted?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/** Audit log entry for every quantity change ("stock_movements" collection). */
export interface StockMovement<Id = ObjectId> {
    _id: Id;
    inventoryId: Id;
    departmentId: Id;
    departmentName: string;
    clientId?: Id;
    productName: string;
    sku: string;
    type: MovementType;
    amount: number;
    previousBalance?: number;
    newBalance?: number;
    reason: string;
    user: { id?: Id; name?: string | null; email?: string | null };
    createdAt: Date;
}

/** One product row of the consumption report. */
export interface ConsumptionReportItem {
    inventoryId: string;
    productName: string;
    sku: string;
    initialQuantity: number;
    totalIn: number;
    totalOut: number;
    finalBalance: number;
    finalQuantity: number;
}

export interface ConsumptionReportDepartment {
    _id: string;
    departmentName: string;
    items: ConsumptionReportItem[];
}
