import type { Session } from "next-auth";
import { getDb, toObjectId, type ErrorKey } from "@/lib/api";
import { billingConfigured, checkoutVariant, createCheckout, type BillingInterval } from "@/lib/billing";
import { PERMISSIONS } from "@/lib/constants";
import { canCloseOrganization, OPEN_ORGANIZATION } from "@/lib/organizations";
import { hasPermission } from "@/lib/permissions";
import { subscriptionGivesAccess } from "@/lib/plans";
import type { Organization, Plan } from "@/types/models";

export type CheckoutResult = { url: string; error?: undefined } | { url?: undefined; error: ErrorKey; status: number };

export const isBillingInterval = (value: unknown): value is BillingInterval => value === "monthly" || value === "yearly";

/**
 * Where the session's organization pays for a plan: a new Lemon Squeezy checkout, or its customer portal when it
 * already has a subscription (plan changes and cancellations happen there, and come back through the webhook).
 * Only the organization's owner can pay (same rule as closing it). Shared by POST /api/billing/checkout (the
 * /admin/plan page) and the /checkout page (the sign-up flow from /pricing and the home page).
 * @param redirectUrl Where Lemon Squeezy sends the buyer after paying.
 */
export async function organizationCheckout(session: Session, rawPlanId: unknown, interval: BillingInterval, redirectUrl: string): Promise<CheckoutResult> {
    if (!hasPermission(session, PERMISSIONS.MANAGE_USERS)) return { error: "forbidden", status: 403 };
    const clientId = toObjectId(session.user.clientId);
    if (!clientId) return { error: "unauthorized", status: 401 };
    if (!billingConfigured()) return { error: "billingNotConfigured", status: 503 };
    const planId = toObjectId(rawPlanId);
    if (!planId) return { error: "invalidData", status: 400 };

    const db = await getDb();
    const [organization, plan] = await Promise.all([
        db.collection<Organization>("clients").findOne({ _id: clientId, ...OPEN_ORGANIZATION }),
        // A custom plan can only be bought by the organization it was made for
        db.collection<Plan>("plans").findOne({ _id: planId, isActive: { $ne: false }, $or: [{ isCustom: { $ne: true } }, { clientId }] }),
    ]);
    if (!organization || !plan) return { error: "notFound", status: 404 };
    if (!canCloseOrganization(session, organization)) return { error: "ownerOnly", status: 403 };

    if (organization.subscription && subscriptionGivesAccess(organization.subscription) && organization.subscription.portalUrl) {
        return { url: organization.subscription.portalUrl };
    }

    const variant = checkoutVariant(plan, interval);
    if (!variant) return { error: "planNotPurchasable", status: 400 };

    const url = await createCheckout({
        ...variant,
        clientId: clientId.toString(),
        planId: plan._id.toString(),
        email: session.user.email,
        name: session.user.name,
        redirectUrl,
    });
    return { url };
}
