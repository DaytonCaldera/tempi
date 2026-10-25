import { redirect } from "next/navigation";
import { CheckCircle2, Receipt } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { getDb, toObjectId } from "@/lib/api";
import { billingConfigured, latestPaidInvoice } from "@/lib/billing";
import { LEGAL, PERMISSIONS, REFUND_GUARANTEE_DAYS } from "@/lib/constants";
import { planLabel } from "@/i18n/labels";
import { canCloseOrganization } from "@/lib/organizations";
import { hasPermission } from "@/lib/permissions";
import { getPlanUsage, listActivePlans } from "@/lib/plans";
import { refundDeadline, refundEligible } from "@/lib/subscription-changes";
import PlanUsageCard from "@/components/admin/PlanUsageCard";
import PricingTable, { type PricingSubscription } from "@/components/plan/PricingTable";
import SubscriptionPanel, { type SubscriptionView } from "@/components/plan/SubscriptionPanel";
import type { Organization, Plan } from "@/types/models";

/**
 * The organization's plan: what it uses, its trial or subscription, and the plans it can move to.
 * Paying happens on Lemon Squeezy (app/api/billing/checkout); once it pays, plan changes, cancelling and resuming
 * happen here (app/api/billing/subscription). The webhook keeps the subscription up to date.
 */
export default async function PlanPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
    const session = await auth();
    if (!session) redirect("/");
    if (!hasPermission(session, PERMISSIONS.MANAGE_USERS)) redirect("/unauthorized");
    const clientId = toObjectId(session.user.clientId);
    if (!clientId) redirect("/lobby");

    const db = await getDb();
    const [usage, plans, t, tPlan, format, { checkout }, organization] = await Promise.all([
        getPlanUsage(clientId), listActivePlans(clientId), getTranslations("plan.page"), getTranslations("plan"), getFormatter(), searchParams,
        db.collection<Organization>("clients").findOne({ _id: clientId }, { projection: { ownerEmail: 1, subscription: 1 } }),
    ]);
    const date = (value: string | null) => value ? format.dateTime(new Date(value), { dateStyle: "long" }) : "—";
    const manualBilling = usage.plan?.isCustom && usage.plan.billingMode === "manual";
    const isOwner = !!organization && canCloseOrganization(session, organization);

    let subscriptionView: SubscriptionView | null = null;
    let pricingSubscription: PricingSubscription | null = null;
    const stored = organization?.subscription;
    if (usage.subscription && stored && usage.plan) {
        const { status, interval, scheduledChange, refunded } = usage.subscription;
        const scheduledPlan = scheduledChange
            ? await db.collection<Plan>("plans").findOne({ _id: toObjectId(scheduledChange.planId)! }, { projection: { name: 1, key: 1, isCustom: 1 } })
            : null;
        const refund = await refundOffer(stored, interval);
        const live = usage.source === "subscription" && (status === "active" || status === "on_trial");
        subscriptionView = {
            status,
            givesAccess: usage.source === "subscription",
            planName: planLabel(tPlan, usage.plan),
            interval,
            renewsAt: usage.subscription.renewsAt,
            endsAt: usage.subscription.endsAt,
            portalUrl: usage.subscription.portalUrl,
            refunded,
            scheduledChange: scheduledChange ? { planName: scheduledPlan ? planLabel(tPlan, scheduledPlan) : "—", interval: scheduledChange.interval, at: scheduledChange.at } : null,
            refund,
            isOwner,
        };
        if (usage.source === "subscription") {
            pricingSubscription = {
                planId: usage.plan._id,
                interval,
                renewsAt: usage.subscription.renewsAt,
                changeable: !isOwner ? "ownerOnly" : !live ? "inactive" : scheduledChange ? "pending" : usage.plan.isCustom ? "custom" : "yes",
            };
        }
    }

    return (
        <div className="p-0 lg:p-10">
            <h1 className="mb-8 text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>

            {checkout === "success" && (
                <p role="status" className="mb-6 flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-5 py-3 text-sm text-ink">
                    <CheckCircle2 size={16} className="text-success" aria-hidden /> {t("checkoutSuccess")}
                </p>
            )}

            <div className="mb-8"><PlanUsageCard usage={usage} upgradeLink={false} /></div>

            {subscriptionView ? (
                <SubscriptionPanel subscription={subscriptionView} />
            ) : (usage.source === "trial" || manualBilling) && (
                <section className="mb-10 flex items-start gap-3 rounded-3xl border border-line bg-card p-6">
                    <Receipt size={20} className="mt-0.5 text-accent" aria-hidden />
                    <div className="text-sm">
                        {usage.source === "trial" ? (
                            <>
                                <p className="font-semibold text-ink">{t("trialTitle")}</p>
                                <p className="text-ink-muted">{t("trialBody", { date: date(usage.trialEndsAt) })}</p>
                            </>
                        ) : (
                            <>
                                <p className="font-semibold text-ink">{t("manualTitle")}</p>
                                <p className="text-ink-muted">{t("manualBody", { email: LEGAL.contactEmail })}</p>
                            </>
                        )}
                    </div>
                </section>
            )}

            <h2 className="mb-6 text-xl font-semibold tracking-tight">{t("comparePlans")}</h2>
            <PricingTable plans={plans} mode="admin" currentPlanId={usage.plan?._id ?? null} subscription={pricingSubscription} />
            <p className="mt-8 text-center text-xs text-ink-subtle">{t("refundPolicy", { days: REFUND_GUARANTEE_DAYS })}</p>
            <p className="mt-2 text-center text-xs text-ink-subtle">{t("fairUse", { email: LEGAL.contactEmail })}</p>
        </div>
    );
}

/**
 * The refund the owner can still get by cancelling (the latest yearly payment, within the guarantee), or null.
 * Asked to Lemon Squeezy only for yearly subscriptions; a failure just hides the offer.
 */
async function refundOffer(subscription: NonNullable<Organization["subscription"]>, interval: "monthly" | "yearly") {
    if (interval !== "yearly" || subscription.refundedAt || !billingConfigured()) return null;
    if (subscription.status !== "active" && subscription.status !== "cancelled") return null;
    try {
        const invoice = await latestPaidInvoice(subscription.id);
        if (!invoice || !refundEligible({ ...subscription, interval }, invoice)) return null;
        return { amount: invoice.total / 100, deadline: refundDeadline(invoice.createdAt).toISOString() };
    } catch (error) {
        console.error(`Could not read the invoices of subscription ${subscription.id}:`, error);
        return null;
    }
}
