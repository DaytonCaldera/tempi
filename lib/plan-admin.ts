import type { ObjectId } from "mongodb";
import { getDb } from "@/lib/api";
import { PLAN_FEATURES } from "@/lib/constants";
import { countUsage, LIMITED_RESOURCES, limitOf, toPlanSummary, type LimitedResource, type PlanSummary } from "@/lib/plans";
import { OPEN_ORGANIZATION } from "@/lib/organizations";
import type { Organization, Plan } from "@/types/models";

/**
 * Server only: the superadmin's plan editor (/superadmin/plans). Lists every plan with who uses it, reads and
 * validates the plan form, and tells how a change would land on the organizations that use the plan.
 */

/** Organizations that use a plan in any way: assigned, on a trial of it, or subscribed to it. */
const usingPlan = (planId: ObjectId) => ({
    ...OPEN_ORGANIZATION,
    $or: [{ planId }, { "trial.planId": planId }, { "subscription.planId": planId }],
});

export type AdminPlanRow = PlanSummary & {
    isActive: boolean;
    notes: string | null;
    organizations: number;
    /** The organization a custom plan was made for */
    owner: { _id: string; name: string } | null;
    billing: { monthlyVariantId: string | null; yearlyVariantId: string | null };
};

/** Every plan, catalog first (cheapest first), then the custom ones, with how many open organizations use each. */
export async function listPlansForAdmin(): Promise<AdminPlanRow[]> {
    const db = await getDb();
    const plans = await db.collection<Plan>("plans").find({}).sort({ isCustom: 1, price: 1, name: 1 }).toArray();
    const ownerIds = plans.map(p => p.clientId).filter((id): id is ObjectId => !!id);
    const [counts, owners] = await Promise.all([
        Promise.all(plans.map(p => db.collection("clients").countDocuments(usingPlan(p._id)))),
        ownerIds.length ? db.collection<Organization>("clients").find({ _id: { $in: ownerIds } }, { projection: { name: 1 } }).toArray() : [],
    ]);
    return plans.map((plan, i) => {
        const owner = plan.clientId && owners.find(o => o._id.equals(plan.clientId!));
        return {
            ...toPlanSummary(plan),
            isActive: plan.isActive !== false,
            notes: plan.notes ?? null,
            organizations: counts[i],
            owner: owner ? { _id: owner._id.toString(), name: owner.name } : null,
            billing: { monthlyVariantId: plan.billing?.monthlyVariantId ?? null, yearlyVariantId: plan.billing?.yearlyVariantId ?? null },
        };
    });
}

export async function getPlanForAdmin(planId: ObjectId) {
    return (await listPlansForAdmin()).find(p => p._id === planId.toString()) ?? null;
}

/** The fields of the plan form, validated. */
export type PlanInput = Pick<Plan, "name" | "price" | "priceYearly" | "maxUsers" | "maxDepartments" | "maxItems" | "historyDays" | "features" | "billingMode" | "isActive"> & {
    notes: string;
    billing: { monthlyVariantId?: string; yearlyVariantId?: string };
};

const FEATURE_VALUES = Object.values(PLAN_FEATURES) as string[];

/** A whole number from 0 up, or null when the field isn't one (empty means 0: unlimited). */
const count = (value: FormDataEntryValue | null) => {
    const text = String(value ?? "").trim();
    if (text === "") return 0;
    const n = Number(text);
    return Number.isInteger(n) && n >= 0 && n <= 10_000_000 ? n : null;
};

/** USD with at most 2 decimals, from 0 up, or null. */
const money = (value: FormDataEntryValue | null) => {
    const text = String(value ?? "").trim().replace(",", ".");
    if (text === "") return 0;
    const n = Number(text);
    return Number.isFinite(n) && n >= 0 && n <= 100_000 ? Math.round(n * 100) / 100 : null;
};

const variant = (value: FormDataEntryValue | null) => {
    const text = String(value ?? "").trim();
    return /^\d{1,20}$/.test(text) ? text : undefined;
};

/** Reads the plan form. Returns null when a field is invalid. */
export function readPlanForm(form: FormData): PlanInput | null {
    const name = String(form.get("name") ?? "").trim();
    const numbers = {
        price: money(form.get("price")),
        priceYearly: money(form.get("priceYearly")),
        maxUsers: count(form.get("maxUsers")),
        maxDepartments: count(form.get("maxDepartments")),
        maxItems: count(form.get("maxItems")),
        historyDays: count(form.get("historyDays")),
    };
    const billingMode = form.get("billingMode") === "manual" ? "manual" : "lemonsqueezy";
    const features = form.getAll("features").map(String);
    if (!name || name.length > 60 || Object.values(numbers).some(n => n === null) || features.some(f => !FEATURE_VALUES.includes(f))) return null;

    return {
        name,
        ...(numbers as Record<keyof typeof numbers, number>),
        features: [...new Set(features)],
        billingMode,
        isActive: form.get("isActive") !== "off",
        notes: String(form.get("notes") ?? "").trim().slice(0, 1000),
        billing: { monthlyVariantId: variant(form.get("monthlyVariantId")), yearlyVariantId: variant(form.get("yearlyVariantId")) },
    };
}

export type PlanImpact = {
    organizations: number;
    /** Organizations that would be over a limit of the new values: they keep everything, but can't grow */
    over: { _id: string; name: string; resources: { resource: LimitedResource; used: number; limit: number }[] }[];
};

/** How the new limits would land on the organizations that use the plan (or on `clientId`, for a new custom plan). */
export async function planImpact(input: PlanInput, planId: ObjectId | null, clientId: ObjectId | null): Promise<PlanImpact> {
    const db = await getDb();
    const filter = planId ? usingPlan(planId) : clientId ? { _id: clientId } : null;
    const organizations = filter ? await db.collection<Organization>("clients").find(filter, { projection: { name: 1 } }).limit(500).toArray() : [];

    const over: PlanImpact["over"] = [];
    for (const organization of organizations) {
        const usage = await countUsage(organization._id);
        const resources = LIMITED_RESOURCES
            .map(resource => ({ resource, used: usage[resource], limit: limitOf(input, resource) }))
            .filter((r): r is { resource: LimitedResource; used: number; limit: number } => r.limit !== null && r.used > r.limit);
        if (resources.length) over.push({ _id: organization._id.toString(), name: organization.name, resources });
    }
    return { organizations: organizations.length, over };
}

/** Open organizations, for picking the one a new custom plan is for. */
export async function listOpenOrganizations() {
    const db = await getDb();
    const rows = await db.collection<Organization>("clients").find(OPEN_ORGANIZATION, { projection: { name: 1 } }).sort({ name: 1 }).limit(1000).toArray();
    return rows.map(o => ({ _id: o._id.toString(), name: o.name }));
}
