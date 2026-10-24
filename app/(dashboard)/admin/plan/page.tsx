import { redirect } from "next/navigation";
import { CheckCircle2, ExternalLink, Receipt } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { toObjectId } from "@/lib/api";
import { LEGAL, PERMISSIONS } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";
import { getPlanUsage, listActivePlans } from "@/lib/plans";
import PlanUsageCard from "@/components/admin/PlanUsageCard";
import PricingTable from "@/components/plan/PricingTable";

/**
 * The organization's plan: what it uses, its trial or subscription, and the plans it can move to.
 * Paying happens on Lemon Squeezy (app/api/billing); its webhook updates the subscription.
 */
export default async function PlanPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
    const session = await auth();
    if (!session) redirect("/");
    if (!hasPermission(session, PERMISSIONS.MANAGE_USERS)) redirect("/unauthorized");
    const clientId = toObjectId(session.user.clientId);
    if (!clientId) redirect("/lobby");

    const [usage, plans, t, format, { checkout }] = await Promise.all([
        getPlanUsage(clientId), listActivePlans(clientId), getTranslations("plan.page"), getFormatter(), searchParams,
    ]);
    const date = (value: string | null) => value ? format.dateTime(new Date(value), { dateStyle: "long" }) : "—";
    const { subscription } = usage;
    const manualBilling = usage.plan?.isCustom && usage.plan.billingMode === "manual";

    return (
        <div className="p-0 lg:p-10">
            <h1 className="mb-8 text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>

            {checkout === "success" && (
                <p role="status" className="mb-6 flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-5 py-3 text-sm text-ink">
                    <CheckCircle2 size={16} className="text-success" aria-hidden /> {t("checkoutSuccess")}
                </p>
            )}

            <div className="mb-8"><PlanUsageCard usage={usage} upgradeLink={false} /></div>

            {(subscription || usage.source === "trial" || manualBilling) && (
                <section className="mb-10 flex flex-col gap-4 rounded-3xl border border-line bg-card p-6 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                        <Receipt size={20} className="mt-0.5 text-accent" aria-hidden />
                        <div className="text-sm">
                            {subscription ? (
                                <>
                                    <p className="font-semibold text-ink">{t(`subscription.${subscription.status}`)}</p>
                                    <p className="text-ink-muted">
                                        {subscription.status === "cancelled"
                                            ? t("endsOn", { date: date(subscription.endsAt) })
                                            : subscription.renewsAt ? t("renewsOn", { date: date(subscription.renewsAt) }) : null}
                                    </p>
                                </>
                            ) : usage.source === "trial" ? (
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
                    </div>
                    {subscription?.portalUrl && (
                        <a href={subscription.portalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 self-start rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:border-line-strong md:self-auto">
                            {t("manage")} <ExternalLink size={14} aria-hidden />
                        </a>
                    )}
                </section>
            )}

            <h2 className="mb-6 text-xl font-semibold tracking-tight">{t("comparePlans")}</h2>
            <PricingTable plans={plans} mode="admin" currentPlanId={usage.plan?._id ?? null} />
            <p className="mt-8 text-center text-xs text-ink-subtle">{t("fairUse", { email: LEGAL.contactEmail })}</p>
        </div>
    );
}
