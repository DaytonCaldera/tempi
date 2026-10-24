import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/lib/api";
import { BILLING_GRACE_DAYS, type PlanFeature, ROLES } from "@/lib/constants";
import type { Organization, Plan, PlanKey, Subscription } from "@/types/models";

/**
 * Server only: plans ("plans" collection) and what they allow.
 * - Limits (maxUsers, maxDepartments, maxItems): an organization can't grow past its plan: approving or
 *   reactivating a member, creating a department and creating a product check the limit first.
 * - Features (PLAN_FEATURES) and history (historyDays): checked by the routes that offer them.
 * Nothing is taken away from an organization already over a limit (e.g. after a downgrade); it just can't add
 * more. Organizations without a plan, and limits that are missing or 0, are unlimited. The superadmin's support
 * tools aren't limited.
 *
 * The plan that applies (the effective plan) is worked out on every read, so nothing has to run when a trial
 * or a cancelled subscription ends: a subscription that gives access, else a trial that hasn't ended, else the
 * organization's planId (the free plan, or one the superadmin assigned).
 */

export const LIMITED_RESOURCES = ["users", "departments", "items"] as const;
export type LimitedResource = typeof LIMITED_RESOURCES[number];

const LIMIT_FIELD: Record<LimitedResource, keyof Pick<Plan, "maxUsers" | "maxDepartments" | "maxItems">> = {
    users: "maxUsers",
    departments: "maxDepartments",
    items: "maxItems",
};

const PLAN_PROJECTION = {
    key: 1, name: 1, price: 1, priceYearly: 1, maxUsers: 1, maxDepartments: 1, maxItems: 1,
    historyDays: 1, features: 1, isCustom: 1, clientId: 1, billingMode: 1, billing: 1, isActive: 1,
} as const;

type LimitFields = Pick<Plan, "maxUsers" | "maxDepartments" | "maxItems">;

/** A limit that applies, or null when there is none. */
export const limitOf = (plan: LimitFields | null, resource: LimitedResource) => {
    const value = Number(plan?.[LIMIT_FIELD[resource]]);
    return value > 0 ? value : null;
};

const DAY = 24 * 60 * 60 * 1000;

/** Whole days left until `date`, at least 1 (for "N days left" messages). */
export const daysUntil = (date: Date | string) => Math.max(1, Math.ceil((new Date(date).getTime() - Date.now()) / DAY));

/** Whether a subscription still gives access to its plan. */
export function subscriptionGivesAccess(subscription: Subscription | undefined, now = new Date()) {
    if (!subscription) return false;
    switch (subscription.status) {
        case "active":
        case "on_trial":
            return true;
        // Lemon Squeezy retries the payment: keep the plan for a few days meanwhile
        case "past_due":
        case "unpaid": {
            const since = subscription.pastDueSince ?? subscription.updatedAt;
            return !!since && now.getTime() - new Date(since).getTime() < BILLING_GRACE_DAYS * DAY;
        }
        // Paid until the end of the period
        case "cancelled":
            return !!subscription.endsAt && new Date(subscription.endsAt) > now;
        default:
            return false;
    }
}

export type PlanSource = "subscription" | "trial" | "assigned";

export type EffectivePlan = {
    plan: Plan | null;
    source: PlanSource;
    trialEndsAt: Date | null;
    subscription: Subscription | null;
};

// The runner polls its stock every few seconds and each poll needs the plan (lib/departments.ts): keep it briefly.
// The cache is per server process, so a plan change can take up to PLAN_CACHE_MS to reach other processes.
const PLAN_CACHE_MS = 30_000;
const planCache = new Map<string, { at: number; value: EffectivePlan }>();

/** Drops the cached plan of one organization (or all), after its plan, trial or subscription changed. */
export function forgetCachedPlans(clientId?: ObjectId | string) {
    if (clientId) planCache.delete(clientId.toString());
    else planCache.clear();
}

/** The plan that applies to the organization now, and why (see the comment at the top). */
export async function getEffectivePlan(clientId: ObjectId): Promise<EffectivePlan> {
    const cached = planCache.get(clientId.toString());
    if (cached && Date.now() - cached.at < PLAN_CACHE_MS) return cached.value;
    const value = await loadEffectivePlan(clientId);
    planCache.set(clientId.toString(), { at: Date.now(), value });
    return value;
}

async function loadEffectivePlan(clientId: ObjectId): Promise<EffectivePlan> {
    const db = await getDb();
    const organization = await db.collection<Organization>("clients").findOne(
        { _id: clientId }, { projection: { planId: 1, subscription: 1, trial: 1 } }
    );
    const subscription = organization?.subscription ?? null;
    const now = new Date();

    const candidates: { planId?: ObjectId; source: PlanSource }[] = [];
    if (subscription && subscriptionGivesAccess(subscription, now)) candidates.push({ planId: subscription.planId, source: "subscription" });
    const trialActive = !!organization?.trial && new Date(organization.trial.endsAt) > now;
    if (trialActive) candidates.push({ planId: organization!.trial!.planId, source: "trial" });
    candidates.push({ planId: organization?.planId, source: "assigned" });

    const ids = candidates.map(c => c.planId).filter((id): id is ObjectId => !!id);
    const plans = ids.length ? await db.collection<Plan>("plans").find({ _id: { $in: ids } }, { projection: PLAN_PROJECTION }).toArray() : [];

    // The first candidate whose plan still exists (a deleted trial plan falls back to the assigned one)
    for (const candidate of candidates) {
        const plan = candidate.planId && plans.find(p => p._id.equals(candidate.planId!));
        if (plan) return { plan, source: candidate.source, trialEndsAt: candidate.source === "trial" ? organization!.trial!.endsAt : null, subscription };
    }
    return { plan: null, source: "assigned", trialEndsAt: null, subscription };
}

/** The organization's effective plan (null when it has none, or it no longer exists). */
export async function getOrganizationPlan(clientId: ObjectId) {
    return (await getEffectivePlan(clientId)).plan;
}

/** What the organization uses of each limited resource. Members count when they are active and approved. */
export async function countUsage(clientId: ObjectId): Promise<Record<LimitedResource, number>> {
    const db = await getDb();
    const departmentIds = (await db.collection("departments").find({ clientId }, { projection: { _id: 1 } }).toArray()).map(d => d._id);
    const [users, items] = await Promise.all([
        // Memberships migrated from the old top-level clientId may store it as a string
        db.collection("users").countDocuments({
            organizations: { $elemMatch: { clientId: { $in: [clientId, clientId.toString()] }, status: "active", role: { $ne: ROLES.PENDING_USER } } },
        }),
        departmentIds.length === 0 ? 0 : db.collection("department_stock").countDocuments({ departmentId: { $in: departmentIds }, isDeleted: { $ne: true } }),
    ]);
    return { users, departments: departmentIds.length, items };
}

/** A plan as the pages see it (ids as strings, only what they show). */
export type PlanSummary = {
    _id: string;
    key: PlanKey | null;
    name: string;
    price: number;
    priceYearly: number;
    historyDays: number | null;
    features: string[];
    isCustom: boolean;
    billingMode: "lemonsqueezy" | "manual";
    /** Whether it can be bought online (it has a Lemon Squeezy variant, or it is a custom plan priced with one) */
    purchasable: boolean;
    limits: Record<LimitedResource, number | null>;
};

export function toPlanSummary(plan: Plan): PlanSummary {
    const billingMode = plan.billingMode ?? "lemonsqueezy";
    return {
        _id: plan._id.toString(),
        key: plan.key ?? null,
        name: plan.name,
        price: Number(plan.price) || 0,
        priceYearly: Number(plan.priceYearly) || 0,
        historyDays: Number(plan.historyDays) > 0 ? Number(plan.historyDays) : null,
        features: plan.features ?? [],
        isCustom: !!plan.isCustom,
        billingMode,
        purchasable: billingMode === "lemonsqueezy" && Number(plan.price) > 0 && (!!plan.billing?.monthlyVariantId || !!plan.isCustom),
        limits: { users: limitOf(plan, "users"), departments: limitOf(plan, "departments"), items: limitOf(plan, "items") },
    };
}

export type PlanUsage = {
    plan: PlanSummary | null;
    source: PlanSource;
    trialEndsAt: string | null;
    subscription: { status: Subscription["status"]; renewsAt: string | null; endsAt: string | null; portalUrl: string | null } | null;
    resources: { resource: LimitedResource; used: number; limit: number | null }[];
};

/** Plan and usage of the organization, for the admin's and the superadmin's pages. */
export async function getPlanUsage(clientId: ObjectId): Promise<PlanUsage> {
    const [effective, usage] = await Promise.all([getEffectivePlan(clientId), countUsage(clientId)]);
    const { plan, subscription } = effective;
    return {
        plan: plan ? toPlanSummary(plan) : null,
        source: effective.source,
        trialEndsAt: effective.trialEndsAt ? new Date(effective.trialEndsAt).toISOString() : null,
        subscription: subscription ? {
            status: subscription.status,
            renewsAt: subscription.renewsAt ? new Date(subscription.renewsAt).toISOString() : null,
            endsAt: subscription.endsAt ? new Date(subscription.endsAt).toISOString() : null,
            portalUrl: subscription.portalUrl ?? null,
        } : null,
        resources: LIMITED_RESOURCES.map(resource => ({ resource, used: usage[resource], limit: limitOf(plan, resource) })),
    };
}

/**
 * Whether `adding` more of `resource` (one by default) fit in the organization's plan. Returns null when they do,
 * or the error response to send (403, `{ error, code: "planLimit" }`, the message names the plan and the limit).
 */
export async function planLimitError(clientId: ObjectId, resource: LimitedResource, adding = 1): Promise<NextResponse | null> {
    const plan = await getOrganizationPlan(clientId);
    const limit = limitOf(plan, resource);
    if (limit === null) return null;

    const used = (await countUsage(clientId))[resource];
    if (used + adding <= limit) return null;

    const t = await getTranslations("errors.planLimit");
    return NextResponse.json({ error: t(resource, { limit, plan: plan?.name ?? "" }), code: "planLimit" }, { status: 403 });
}

/**
 * Whether the plan includes the feature. No plan means no restrictions, like the limits. Neither do plans from
 * before the catalog that scripts/seed-plans.js hasn't migrated yet (no key, not custom): their features are free
 * text, so restricting by them would take features away from organizations until the seed runs.
 */
export const planHasFeature = (plan: { features?: string[]; key?: string | null; isCustom?: boolean } | null, feature: PlanFeature) =>
    !plan || (!plan.key && !plan.isCustom) || (plan.features ?? []).includes(feature);

export async function hasPlanFeature(clientId: ObjectId, feature: PlanFeature) {
    return planHasFeature(await getOrganizationPlan(clientId), feature);
}

/**
 * Null when the organization's plan includes the feature, or the error response to send
 * (403, `{ error, code: "planFeature" }`), like planLimitError.
 */
export async function planFeatureError(clientId: ObjectId, feature: PlanFeature): Promise<NextResponse | null> {
    const plan = await getOrganizationPlan(clientId);
    if (planHasFeature(plan, feature)) return null;

    const t = await getTranslations("errors.planFeature");
    return NextResponse.json({ error: t(feature, { plan: plan?.name ?? "" }), code: "planFeature" }, { status: 403 });
}

/**
 * The earliest date the plan lets reports look at. Movements are never deleted: older ones just can't be
 * queried, and come back when the organization moves to a plan with more history.
 * @returns `start` moved forward to that date when it is earlier, and `limitedFrom` set when it was moved.
 */
export function clampToHistory(plan: Pick<Plan, "historyDays"> | null, start: Date) {
    const days = Number(plan?.historyDays);
    if (!(days > 0)) return { start, limitedFrom: null };
    const earliest = new Date(Date.now() - days * DAY);
    earliest.setHours(0, 0, 0, 0);
    return start < earliest ? { start: earliest, limitedFrom: earliest } : { start, limitedFrom: null };
}

/**
 * Active plans, cheapest first. Custom plans are only included when they belong to `forClientId`
 * (the superadmin's plan picker of that organization), never in other organizations' lists.
 */
export async function listActivePlans(forClientId?: ObjectId | null) {
    const db = await getDb();
    const visibility = forClientId ? { $or: [{ isCustom: { $ne: true } }, { clientId: forClientId }] } : { isCustom: { $ne: true } };
    const plans = await db.collection<Plan>("plans").find({ isActive: { $ne: false }, ...visibility }).sort({ price: 1 }).toArray();
    return plans.map(toPlanSummary);
}

/** The public catalog (Free, Pro, Business) for the pricing page. */
export async function listCatalogPlans() {
    const db = await getDb();
    const plans = await db.collection<Plan>("plans")
        .find({ key: { $exists: true }, isCustom: { $ne: true }, isActive: { $ne: false } }, { projection: PLAN_PROJECTION })
        .sort({ price: 1 }).toArray();
    return plans.map(toPlanSummary);
}
