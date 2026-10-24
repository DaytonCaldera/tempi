"use server";
import { revalidatePath } from "next/cache";
import type { ObjectId } from "mongodb";
import { getDb, toObjectId } from "@/lib/api";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { OPEN_ORGANIZATION } from "@/lib/organizations";
import { planImpact, readPlanForm, type PlanImpact, type PlanInput } from "@/lib/plan-admin";
import { forgetCachedPlans } from "@/lib/plans";
import { requireSuperadmin } from "@/lib/superadmin";
import { guarded, readReason } from "@/lib/support-tools";
import type { Organization, Plan } from "@/types/models";

/** `error` is a key of the "superadmin.plans.errors" messages (or "reasonTooShort" of "superadmin.tools"). */
export type PlanFormState = {
    ok?: boolean;
    error?: "invalid" | "notFound" | "pickOrganization" | "inUse" | "defaultPlan" | "reasonTooShort";
    /** The plan that was saved: the form moves to its page */
    planId?: string;
    impact?: PlanImpact;
};

const EDITABLE_FIELDS = ["name", "price", "priceYearly", "maxUsers", "maxDepartments", "maxItems", "historyDays", "features", "billingMode", "isActive", "notes"] as const;

/** The fields that changed, as { field: { before, after } }, for the audit log. */
function changes(before: Partial<Plan>, after: PlanInput) {
    const result: Record<string, { before: unknown; after: unknown }> = {};
    for (const field of EDITABLE_FIELDS) {
        const was = before[field] ?? null;
        const now = after[field] ?? null;
        if (JSON.stringify(was) !== JSON.stringify(now)) result[field] = { before: was, after: now };
    }
    return result;
}

/**
 * Creates or edits a plan. With intent "preview" it only tells how many organizations use the plan and which
 * would end up over a new limit (they keep everything, but can't grow). With "save" it needs a reason.
 * Form fields: planId (missing for a new plan), clientId (the organization a new custom plan is for),
 * assign ("on": also move that organization to the new plan), the plan's fields (lib/plan-admin.ts readPlanForm).
 * - New plans made here are always custom: the catalog (Free, Pro, Business) comes from scripts/seed-plans.js.
 * - A plan that organizations use can't be deactivated, and the free plan never can (new organizations get it).
 */
export async function savePlan(_: PlanFormState, form: FormData): Promise<PlanFormState> {
    const session = await requireSuperadmin();
    return guarded("savePlan", async (): Promise<PlanFormState> => {
        const input = readPlanForm(form);
        if (!input) return { error: "invalid" };
        const planId = toObjectId(form.get("planId"));
        const db = await getDb();
        const plans = db.collection<Plan>("plans");

        const existing = planId ? await plans.findOne({ _id: planId }) : null;
        if (planId && !existing) return { error: "notFound" };

        // A new custom plan belongs to one open organization
        const clientId = existing ? existing.clientId ?? null : toObjectId(form.get("clientId"));
        const organization = clientId
            ? await db.collection<Organization>("clients").findOne({ _id: clientId, ...OPEN_ORGANIZATION }, { projection: { name: 1, planId: 1 } })
            : null;
        if (!existing && !organization) return { error: "pickOrganization" };

        const impact = await planImpact(input, existing?._id ?? null, existing ? null : clientId);
        if (form.get("intent") !== "save") return { impact };

        if (existing && !input.isActive) {
            if (existing.key === "free") return { error: "defaultPlan", impact };
            if (impact.organizations > 0) return { error: "inUse", impact };
        }
        const reason = readReason(form);
        if (!reason) return { error: "reasonTooShort", impact };

        const now = new Date();
        const billing = { monthlyVariantId: input.billing.monthlyVariantId, yearlyVariantId: input.billing.yearlyVariantId };
        const fields = { ...input, billing, updatedAt: now };

        let savedId: ObjectId;
        if (existing) {
            await plans.updateOne({ _id: existing._id }, { $set: fields });
            savedId = existing._id;
            await logAudit(AUDIT_ACTIONS.UPDATE_PLAN, {
                actor: session.user, clientId: existing.clientId ?? null, target: { type: "plan", id: existing._id, label: input.name },
                details: { reason, changes: changes(existing, input), organizations: impact.organizations, over: impact.over.length },
            });
        } else {
            const { insertedId } = await plans.insertOne({ ...fields, isCustom: true, clientId: clientId!, createdAt: now } as Plan);
            savedId = insertedId;
            await logAudit(AUDIT_ACTIONS.CREATE_PLAN, {
                actor: session.user, clientId, target: { type: "plan", id: insertedId, label: input.name },
                details: { reason, plan: input },
            });

            // Same as changePlan (organizations/[id]/actions.ts): the organization moves to the new plan
            if (form.get("assign") === "on" && organization) {
                const previous = organization.planId ? await plans.findOne({ _id: organization.planId }, { projection: { name: 1 } }) : null;
                await db.collection("clients").updateOne({ _id: organization._id }, { $set: { planId: insertedId } });
                await logAudit(AUDIT_ACTIONS.CHANGE_PLAN, {
                    actor: session.user, clientId: organization._id, target: { type: "organization", id: organization._id, label: organization.name },
                    details: { reason, plan: { before: previous?.name ?? null, after: input.name } },
                });
                revalidatePath(`/superadmin/organizations/${organization._id}`);
            }
        }

        // Limits and features of a plan apply to every organization that uses it
        forgetCachedPlans();
        revalidatePath("/superadmin/plans");
        revalidatePath(`/superadmin/plans/${savedId}`);
        return { ok: true, planId: savedId.toString(), impact };
    });
}
