import type { ObjectId } from "mongodb";
import type { HoldReason } from "@/lib/offline-sync";

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
    /** IANA time zone chosen in the account. Missing: the browser's (lib/timezone.ts) */
    timeZone?: string;
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
    /** ISO code its costs are in (lib/currency.ts). Missing: USD */
    currency?: string;
    /** Emails the organization gets. Missing: the defaults of alertSettingsOf (lib/stock-alerts.ts) */
    alerts?: { lowStockEmail?: boolean; extraEmails?: string[] };
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
    /** The manufacturer's EAN/UPC or any code the runner scans. Optional; unique like the SKU */
    barcode?: string;
    unit: string;
    category?: string;
    quantity: number;
    minStock: number;
    /** What one unit costs, in the organization's currency. Missing: not set (the product isn't valued) */
    unitCost?: number;
    /** Set when the low stock email went out, cleared when the quantity is back above minStock (lib/stock-alerts.ts) */
    lowStockAlertedAt?: Date;
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
    /** The product's unit cost when it moved, so later cost changes don't rewrite past consumption. Missing on
     *  movements of products without a cost, and on movements from before costs existed */
    unitCost?: number;
    /** Moves made without connection: the id the device gave it (applied once) and when it really happened.
     *  createdAt is when it reached the server (lib/offline-sync.ts) */
    offlineId?: string;
    occurredAt?: Date;
    /** On the two movements of a transfer: the same id, and the other department (where it went or came from) */
    transfer?: { id: Id; departmentId: Id; departmentName: string };
    createdAt: Date;
}

/**
 * A move made without connection that wasn't applied when it synced ("held_movements" collection), for the runner
 * (then, after HOLD_ESCALATE_MS, an admin) to apply or discard. See lib/offline-sync.ts.
 */
export interface HeldMovement<Id = ObjectId> {
    _id: Id;
    offlineId: string;
    clientId: Id;
    departmentId: Id;
    departmentName: string;
    inventoryId: Id;
    productName: string;
    sku: string;
    unit: string;
    type: MovementType;
    amount: number;
    reason: string;
    holdReason: HoldReason;
    /** The colleague's movement it may repeat (possibleDuplicate) */
    duplicateOf?: { userName: string | null; userEmail: string | null; amount: number; createdAt: Date };
    /** When it really happened, and when it reached the server */
    occurredAt: Date;
    heldAt: Date;
    user: { id?: Id | null; name?: string | null; email?: string | null };
    status: "pending" | "applied" | "discarded";
    resolvedAt?: Date;
    resolvedBy?: { name?: string | null; email?: string | null };
}

/** What a transfer will do in the destination (POST /api/admin/inventory/[id]/transfer with dryRun). */
export type TransferPreview = {
    /** The destination product it adds to, or null when one is created */
    target: { _id: string; productName: string; sku: string; quantity: number; unit: string; minStock: number } | null;
    targetDepartmentName: string;
    /** The minimum a created product gets: the source product's */
    newMinStock: number;
};

/** One product row of the consumption report. */
export interface ConsumptionReportItem {
    inventoryId: string;
    productName: string;
    sku: string;
    initialQuantity: number;
    /** Ins and outs, transfers between departments aside */
    totalIn: number;
    totalOut: number;
    /** Stock that came from / went to another department */
    transferIn: number;
    transferOut: number;
    /** The product's current cost per unit, null when it has none */
    unitCost: number | null;
    /** What the outs cost, at the cost each movement had (or the current one, for older movements) */
    consumedValue: number;
    /** Some outs have no cost to value them with: consumedValue leaves them out */
    consumedValueIncomplete: boolean;
    /** totalIn - totalOut + transferIn - transferOut */
    finalBalance: number;
    finalQuantity: number;
}

export interface ConsumptionReportDepartment {
    _id: string;
    departmentName: string;
    items: ConsumptionReportItem[];
}
