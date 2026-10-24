import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/lib/api";
import { ROLES } from "@/lib/constants";
import type { Organization, Plan } from "@/types/models";

/**
 * Server only: plan limits ("plans" collection: maxUsers, maxDepartments, maxItems).
 * An organization can't grow past its plan: approving or reactivating a member, creating a department and
 * creating a product check the limit first. Nothing is taken away from an organization already over it
 * (e.g. after a downgrade); it just can't add more. Organizations without a plan, and limits that are
 * missing or 0, are unlimited. The superadmin's support tools aren't limited.
 */

export const LIMITED_RESOURCES = ["users", "departments", "items"] as const;
export type LimitedResource = typeof LIMITED_RESOURCES[number];

const LIMIT_FIELD: Record<LimitedResource, keyof Pick<Plan, "maxUsers" | "maxDepartments" | "maxItems">> = {
    users: "maxUsers",
    departments: "maxDepartments",
    items: "maxItems",
};

/** A limit that applies, or null when there is none. */
const limitOf = (plan: Pick<Plan, "maxUsers" | "maxDepartments" | "maxItems"> | null, resource: LimitedResource) => {
    const value = Number(plan?.[LIMIT_FIELD[resource]]);
    return value > 0 ? value : null;
};

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

/** The organization's plan (null when it has none, or it no longer exists). */
export async function getOrganizationPlan(clientId: ObjectId) {
    const db = await getDb();
    const organization = await db.collection<Organization>("clients").findOne({ _id: clientId }, { projection: { planId: 1 } });
    if (!organization?.planId) return null;
    return db.collection<Plan>("plans").findOne({ _id: organization.planId }, { projection: { name: 1, maxUsers: 1, maxDepartments: 1, maxItems: 1 } });
}

export type PlanUsage = {
    plan: { _id: string; name: string } | null;
    resources: { resource: LimitedResource; used: number; limit: number | null }[];
};

/** Plan and usage of the organization, for the admin's and the superadmin's pages. */
export async function getPlanUsage(clientId: ObjectId): Promise<PlanUsage> {
    const [plan, usage] = await Promise.all([getOrganizationPlan(clientId), countUsage(clientId)]);
    return {
        plan: plan ? { _id: plan._id.toString(), name: plan.name } : null,
        resources: LIMITED_RESOURCES.map(resource => ({ resource, used: usage[resource], limit: limitOf(plan, resource) })),
    };
}

/**
 * Whether one more `resource` fits in the organization's plan. Returns null when it does, or the error
 * response to send (403, `{ error, code: "planLimit" }`, the message names the plan and the limit).
 */
export async function planLimitError(clientId: ObjectId, resource: LimitedResource): Promise<NextResponse | null> {
    const plan = await getOrganizationPlan(clientId);
    const limit = limitOf(plan, resource);
    if (limit === null) return null;

    const used = (await countUsage(clientId))[resource];
    if (used < limit) return null;

    const t = await getTranslations("errors.planLimit");
    return NextResponse.json({ error: t(resource, { limit, plan: plan?.name ?? "" }), code: "planLimit" }, { status: 403 });
}

/** Active plans, cheapest first, for the superadmin's plan picker. */
export async function listActivePlans() {
    const db = await getDb();
    const plans = await db.collection<Plan>("plans").find({ isActive: { $ne: false } }).sort({ price: 1 }).toArray();
    return plans.map(p => ({
        _id: p._id.toString(), name: p.name, price: p.price,
        limits: { users: limitOf(p, "users"), departments: limitOf(p, "departments"), items: limitOf(p, "items") },
    }));
}
