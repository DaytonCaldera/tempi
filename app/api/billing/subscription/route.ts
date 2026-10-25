import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { apiError, badRequest, getDb, unauthorized, type ErrorKey } from "@/lib/api";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { cancelSubscription, changeSubscriptionVariant, checkoutVariant, latestPaidInvoice, refundInvoice, resumeSubscription } from "@/lib/billing";
import { billingContext, isBillingInterval } from "@/lib/checkout";
import { forgetCachedPlans, subscriptionGivesAccess } from "@/lib/plans";
import { classifyChange, pendingChange, refundEligible, subscriptionTerms } from "@/lib/subscription-changes";
import type { Organization, Plan, ScheduledChange, Subscription } from "@/types/models";

/**
 * POST /api/billing/subscription - The owner manages the organization's paid subscription from /admin/plan.
 * Body: { action, ... }
 * - "change" { planId, interval }: an upgrade is prorated and charged now; a downgrade waits for the end of the paid
 *   period, without refund (lib/subscription-changes.ts).
 * - "keepCurrent": undoes a pending downgrade.
 * - "cancel" { refund? }: keeps the plan until the end of the period. With refund: true, a yearly payment made less
 *   than REFUND_GUARANTEE_DAYS ago is refunded in full and the plan ends now.
 * - "resume": undoes a cancellation before the period ends.
 * Lemon Squeezy confirms every change through its webhook (app/api/billing/webhook); what is written here only
 * shows it right away.
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    try {
        const body = await req.json();
        const context = await billingContext(session, body.action === "change" ? body.planId : undefined);
        if (context.error) return apiError(context.error, context.status);
        const { organization, plan } = context;
        const subscription = organization.subscription;
        if (!subscription || !subscriptionGivesAccess(subscription)) return apiError("subscriptionNotActive", 409);

        let result: Result;
        switch (body.action) {
            case "change":
                if (!plan || !isBillingInterval(body.interval)) return badRequest();
                result = await change(session, organization, subscription, plan, body.interval);
                break;
            case "keepCurrent":
                result = await keepCurrent(session, organization, subscription);
                break;
            case "cancel":
                result = await cancel(session, organization, subscription, body.refund === true);
                break;
            case "resume":
                result = await resume(session, organization, subscription);
                break;
            default:
                return badRequest();
        }
        if (result.error) return apiError(result.error, result.status);
        forgetCachedPlans(organization._id);
        return NextResponse.json({ ok: true, ...result.data });
    } catch (error) {
        console.error("Subscription change error:", error);
        return apiError("subscriptionActionFailed", 502);
    }
}

type Result = { error: ErrorKey; status: number; data?: undefined } | { error?: undefined; data?: Record<string, unknown> };

const clients = async () => (await getDb()).collection<Organization>("clients");

const isLive = (subscription: Subscription) => subscription.status === "active" || subscription.status === "on_trial";

async function change(session: Session, organization: Organization, subscription: Subscription, target: Plan, interval: "monthly" | "yearly"): Promise<Result> {
    if (!isLive(subscription)) return { error: "subscriptionNotActive", status: 409 };
    if (pendingChange(subscription.scheduledChange)) return { error: "scheduledChangePending", status: 409 };

    const terms = subscriptionTerms(subscription);
    const current = await (await getDb()).collection<Plan>("plans").findOne({ _id: terms.planId });
    // Custom plans are priced at checkout (custom_price), which a variant change can't carry: Vitalliz changes them
    if (!current || current.isCustom || target.isCustom) return { error: "customPlanChange", status: 409 };
    const variant = checkoutVariant(target, interval);
    if (!variant) return { error: "planNotPurchasable", status: 400 };

    const kind = classifyChange(
        { planId: current._id.toString(), price: Number(current.price) || 0, interval: terms.interval },
        { planId: target._id.toString(), price: Number(target.price) || 0, interval },
    );
    if (kind === "none") return { error: "noPlanChange", status: 400 };
    const audit = (details: Record<string, unknown>) => logAudit(AUDIT_ACTIONS.SUBSCRIPTION_CHANGE, {
        actor: session.user, clientId: organization._id, target: { type: "organization", id: organization._id, label: organization.name },
        details: { kind, plan: { before: current.name, after: target.name }, interval: { before: terms.interval, after: interval }, ...details },
    });

    if (kind === "upgrade") {
        await changeSubscriptionVariant(subscription.id, variant.variantId, "now");
        // Shown right away; the webhook confirms it (or marks it past_due if the prorated charge fails)
        await (await clients()).updateOne({ _id: organization._id }, {
            $set: { "subscription.planId": target._id, "subscription.variantId": variant.variantId, "subscription.interval": interval, "subscription.scheduledChange": null },
        });
        await audit({ charged: "now" });
        return { data: { kind } };
    }

    if (!subscription.renewsAt || !subscription.variantId) return { error: "subscriptionNotActive", status: 409 };
    const sameInterval = terms.interval === interval;
    const scheduled: ScheduledChange = {
        from: { planId: current._id, interval: terms.interval, variantId: subscription.variantId },
        to: { planId: target._id, interval, variantId: variant.variantId },
        at: new Date(subscription.renewsAt),
        // Same interval: Lemon Squeezy charges the new price at the next renewal, so it is applied now. A new interval
        // would move the billing date: the daily job applies it just before the renewal
        applied: sameInterval,
        requestedBy: session.user.email ?? undefined,
    };
    // Stored before calling Lemon Squeezy, so the webhook the change triggers already finds it
    const collection = await clients();
    await collection.updateOne({ _id: organization._id }, { $set: { "subscription.scheduledChange": scheduled } });
    if (sameInterval) {
        try {
            await changeSubscriptionVariant(subscription.id, variant.variantId, "nextRenewal");
        } catch (error) {
            await collection.updateOne({ _id: organization._id }, { $set: { "subscription.scheduledChange": null } });
            throw error;
        }
    }
    await audit({ charged: "nextRenewal", at: scheduled.at });
    return { data: { kind, at: scheduled.at } };
}

async function keepCurrent(session: Session, organization: Organization, subscription: Subscription): Promise<Result> {
    const change = pendingChange(subscription.scheduledChange);
    if (!change) return { error: "noPlanChange", status: 400 };
    if (change.applied) await changeSubscriptionVariant(subscription.id, change.from.variantId, "nextRenewal");
    await (await clients()).updateOne({ _id: organization._id }, { $set: { "subscription.scheduledChange": null } });
    await logAudit(AUDIT_ACTIONS.SUBSCRIPTION_CHANGE, {
        actor: session.user, clientId: organization._id, target: { type: "organization", id: organization._id, label: organization.name },
        details: { kind: "keepCurrent" },
    });
    return {};
}

async function cancel(session: Session, organization: Organization, subscription: Subscription, refund: boolean): Promise<Result> {
    // An organization that already cancelled can still ask for the refund while the guarantee lasts
    const alreadyCancelled = subscription.status === "cancelled";
    if (alreadyCancelled && !refund) return { error: "subscriptionNotActive", status: 409 };
    const terms = subscriptionTerms(subscription);
    // Checked before cancelling, so a refund that isn't due doesn't cancel either
    const invoice = refund ? await latestPaidInvoice(subscription.id) : null;
    if (refund && !refundEligible({ ...subscription, interval: terms.interval }, invoice)) return { error: "refundNotEligible", status: 409 };

    const collection = await clients();
    const actor = { actor: session.user, clientId: organization._id, target: { type: "organization" as const, id: organization._id, label: organization.name } };
    if (!alreadyCancelled) {
        // Cancelled first: a refund without a cancellation would still renew
        await cancelSubscription(subscription.id);
        await collection.updateOne({ _id: organization._id }, {
            $set: { "subscription.status": "cancelled", "subscription.endsAt": subscription.renewsAt ?? null, "subscription.scheduledChange": null },
        });
        await logAudit(AUDIT_ACTIONS.SUBSCRIPTION_CANCEL, { ...actor, details: { refund, endsAt: subscription.renewsAt ?? null } });
    }

    if (refund && invoice) {
        try {
            await refundInvoice(invoice.id);
        } catch (error) {
            console.error(`Refund of invoice ${invoice.id} (subscription ${subscription.id}) failed after cancelling:`, error);
            return { error: "refundFailed", status: 502 };
        }
        await collection.updateOne({ _id: organization._id }, { $set: { "subscription.refundedAt": new Date() } });
        await logAudit(AUDIT_ACTIONS.SUBSCRIPTION_REFUND, { ...actor, details: { invoiceId: invoice.id, amount: invoice.total / 100 } });
        return { data: { refunded: true } };
    }
    return { data: { endsAt: subscription.renewsAt ?? null } };
}

async function resume(session: Session, organization: Organization, subscription: Subscription): Promise<Result> {
    if (subscription.status !== "cancelled" || subscription.refundedAt) return { error: "subscriptionNotActive", status: 409 };
    await resumeSubscription(subscription.id);
    await (await clients()).updateOne({ _id: organization._id }, {
        $set: { "subscription.status": "active", "subscription.renewsAt": subscription.endsAt ?? null, "subscription.endsAt": null },
    });
    await logAudit(AUDIT_ACTIONS.SUBSCRIPTION_RESUME, {
        actor: session.user, clientId: organization._id, target: { type: "organization", id: organization._id, label: organization.name },
    });
    return {};
}
