"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, CheckCircle2, Loader2, Minus } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { planLabel } from "@/i18n/labels";
import { PLAN_FEATURES } from "@/lib/constants";
import type { PlanSummary } from "@/lib/plans";
import { classifyChange, estimateUpgradeCharge, type ChangeKind } from "@/lib/subscription-changes";
import { useSubscriptionAction } from "./useSubscriptionAction";

export type BillingInterval = "monthly" | "yearly";

/**
 * The organization's paid subscription (admin mode): plan changes go through POST /api/billing/subscription,
 * prorated, instead of a new checkout. `changeable` says why one can't be made from here.
 */
export type PricingSubscription = {
    planId: string;
    interval: BillingInterval;
    renewsAt: string | null;
    changeable: "yes" | "pending" | "custom" | "ownerOnly" | "inactive";
};

type PendingChange = { plan: PlanSummary; interval: BillingInterval; kind: ChangeKind; estimate: number | null };

interface PricingTableProps {
    plans: PlanSummary[];
    /**
     * "public": the free plan leads to sign-in, paid plans to /checkout, which signs up and pays (/pricing and the home page).
     * "admin": paid plans start a checkout for the organization (the /admin/plan page).
     */
    mode: "public" | "admin";
    /** The organization's effective plan, marked as current (admin mode) */
    currentPlanId?: string | null;
    subscription?: PricingSubscription | null;
}

/** Plan cards with a monthly/yearly switch. Limits of null are unlimited (lib/plans.ts). */
export default function PricingTable({ plans, mode, currentPlanId, subscription }: PricingTableProps) {
    const t = useTranslations("pricing");
    const tPlan = useTranslations("plan");
    const tPage = useTranslations("plan.page");
    const format = useFormatter();
    const [interval, setBillingInterval] = useState<BillingInterval>(subscription?.interval ?? "monthly");
    const [change, setChange] = useState<PendingChange | null>(null);
    const [changed, setChanged] = useState<string | null>(null);
    const action = useSubscriptionAction();
    const [buying, setBuying] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const hasYearly = plans.some(p => p.priceYearly > 0);

    const money = (value: number) => format.number(value, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    const exactMoney = (value: number) => format.number(value, { style: "currency", currency: "USD" });
    const date = (value: string | null) => value ? format.dateTime(new Date(value), { dateStyle: "long" }) : "—";
    const currentPlan = plans.find(p => p._id === currentPlanId) ?? null;
    const amountOf = (plan: PlanSummary, value: BillingInterval) => value === "yearly" ? plan.priceYearly : plan.price;

    /** Asks to confirm a change of the paid subscription, with what it charges or when it happens. */
    const askChange = (plan: PlanSummary, value: BillingInterval) => {
        if (!subscription || !currentPlan) return;
        const kind = classifyChange(
            { planId: currentPlan._id, price: currentPlan.price, interval: subscription.interval },
            { planId: plan._id, price: plan.price, interval: value },
        );
        const estimate = kind === "upgrade" ? estimateUpgradeCharge({
            currentAmount: amountOf(currentPlan, subscription.interval),
            newAmount: amountOf(plan, value),
            interval: subscription.interval,
            renewsAt: subscription.renewsAt ? new Date(subscription.renewsAt) : null,
        }) : null;
        action.clearError();
        setChange({ plan, interval: value, kind, estimate });
    };

    const confirmChange = async () => {
        if (!change || action.busy) return;
        const data = await action.run({ action: "change", planId: change.plan._id, interval: change.interval });
        if (data) {
            setChanged(data.kind === "upgrade" ? tPage("changedNow") : tPage("changeScheduled", { date: date(typeof data.at === "string" ? data.at : null) }));
            setChange(null);
        }
    };
    const limit = (value: number | null) => value === null ? tPlan("unlimited") : format.number(value);

    const buy = async (plan: PlanSummary) => {
        setBuying(plan._id);
        setError(null);
        try {
            const res = await fetch("/api/billing/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planId: plan._id, interval }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.url) {
                window.location.assign(data.url);
                return;
            }
            setError(data.error || t("checkoutFailed"));
        } catch {
            setError(t("checkoutFailed"));
        }
        setBuying(null);
    };

    return (
        <div>
            {hasYearly && (
                <div role="radiogroup" aria-label={t("interval.label")} className="mx-auto mb-10 flex w-fit rounded-full border border-line bg-card p-1">
                    {(["monthly", "yearly"] as const).map(value => (
                        <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={interval === value}
                            onClick={() => setBillingInterval(value)}
                            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${interval === value ? "bg-inverse text-on-inverse" : "text-ink-muted hover:text-ink"}`}
                        >
                            {t(`interval.${value}`)}
                            {value === "yearly" && <span className="ml-2 text-xs font-medium text-accent">{t("interval.saving")}</span>}
                        </button>
                    ))}
                </div>
            )}

            <div className={`grid gap-6 ${plans.length >= 3 ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
                {plans.map(plan => {
                    const highlighted = plan.key === "pro";
                    const yearly = interval === "yearly" && plan.priceYearly > 0;
                    const planInterval: BillingInterval = yearly ? "yearly" : "monthly";
                    const price = yearly ? plan.priceYearly : plan.price;
                    // With a subscription, the same plan with the other interval is a change too
                    const samePlan = mode === "admin" && plan._id === currentPlanId;
                    const isCurrent = samePlan && (!subscription || subscription.interval === planInterval);
                    const buyable = plan.price > 0 && (yearly ? plan.yearlyPurchasable : plan.purchasable);
                    const rows = [
                        { label: t("rows.users", { value: limit(plan.limits.users) }), included: true },
                        { label: t("rows.departments", { value: limit(plan.limits.departments) }), included: true },
                        { label: t("rows.items", { value: limit(plan.limits.items) }), included: true },
                        { label: plan.historyDays ? t("rows.history", { days: plan.historyDays }) : t("rows.historyFull"), included: true },
                        { label: t("rows.runner"), included: true },
                        { label: t("rows.exports"), included: true },
                        ...Object.values(PLAN_FEATURES).map(feature => ({ label: t(`features.${feature}`), included: plan.features.includes(feature) })),
                    ];

                    return (
                        <section
                            key={plan._id}
                            aria-label={planLabel(tPlan, plan)}
                            className={`relative flex flex-col rounded-3xl border bg-card p-7 ${highlighted ? "border-accent shadow-lg" : "border-line"}`}
                        >
                            {highlighted && (
                                <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-on-accent">
                                    {t("popular")}
                                </span>
                            )}
                            <h2 className="text-xl font-semibold tracking-tight">{planLabel(tPlan, plan)}</h2>
                            {plan.key && <p className="mt-1 min-h-10 text-sm text-ink-muted">{t(`taglines.${plan.key}`)}</p>}

                            <p className="mt-6 flex items-baseline gap-1">
                                <span className="text-4xl font-semibold tracking-tight tabular-nums">{price > 0 ? money(price) : t("free")}</span>
                                {price > 0 && <span className="text-sm text-ink-subtle">{yearly ? t("perYear") : t("perMonth")}</span>}
                            </p>
                            {yearly && <p className="text-xs text-ink-subtle">{t("yearlyEquivalent", { price: money(plan.priceYearly / 12) })}</p>}

                            <ul className="my-7 flex flex-col gap-3 text-sm">
                                {rows.map(row => (
                                    <li key={row.label} className={`flex items-start gap-2 ${row.included ? "text-ink" : "text-ink-subtle"}`}>
                                        {row.included
                                            ? <Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                                            : <Minus size={16} className="mt-0.5 shrink-0" aria-hidden />}
                                        <span>{row.label}{!row.included && <span className="sr-only"> · {t("notIncluded")}</span>}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-auto">
                                {mode === "public" ? (
                                    <Link href={buyable ? `/checkout?${new URLSearchParams({ plan: plan._id, interval: yearly ? "yearly" : "monthly" })}` : "/login"} className={`block w-full rounded-full py-3 text-center text-sm font-semibold transition ${highlighted ? "bg-accent text-on-accent hover:brightness-110" : "bg-inverse text-on-inverse hover:bg-accent hover:text-on-accent"}`}>
                                        {price > 0 ? t("start") : t("startFree")}
                                    </Link>
                                ) : isCurrent ? (
                                    <p className="w-full rounded-full border border-line py-3 text-center text-sm font-semibold text-ink-muted">{t("current")}</p>
                                ) : subscription && plan.price === 0 ? (
                                    <p className="text-center text-xs text-ink-subtle">{t("freeViaCancel")}</p>
                                ) : subscription && subscription.changeable !== "yes" ? (
                                    <p className="text-center text-xs text-ink-subtle">{t(`changeBlocked.${subscription.changeable}`)}</p>
                                ) : subscription && buyable ? (
                                    <button
                                        type="button"
                                        onClick={() => askChange(plan, planInterval)}
                                        className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition ${highlighted ? "bg-accent text-on-accent hover:brightness-110" : "bg-inverse text-on-inverse hover:bg-accent hover:text-on-accent"}`}
                                    >
                                        {samePlan ? t(`switchTo.${planInterval}`) : t("upgrade", { plan: planLabel(tPlan, plan) })}
                                    </button>
                                ) : buyable ? (
                                    <button
                                        type="button"
                                        onClick={() => buy(plan)}
                                        aria-disabled={buying !== null}
                                        className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition aria-disabled:opacity-60 ${highlighted ? "bg-accent text-on-accent hover:brightness-110" : "bg-inverse text-on-inverse hover:bg-accent hover:text-on-accent"}`}
                                    >
                                        {buying === plan._id && <Loader2 size={16} className="animate-spin" aria-hidden />}
                                        {t("upgrade", { plan: planLabel(tPlan, plan) })}
                                    </button>
                                ) : plan.price > 0 ? (
                                    <p className="text-center text-xs text-ink-subtle">{t("contactToBuy")}</p>
                                ) : null}
                            </div>
                        </section>
                    );
                })}
            </div>

            {error && <p role="alert" className="mt-6 text-center text-sm font-semibold text-danger">{error}</p>}
            {changed && (
                <p role="status" className="mt-6 flex items-center justify-center gap-2 text-sm text-ink">
                    <CheckCircle2 size={16} className="text-success" aria-hidden /> {changed}
                </p>
            )}

            {change && currentPlan && subscription && (
                <Modal
                    isOpen
                    onClose={() => setChange(null)}
                    title={tPage("changeDialog.title", { plan: planLabel(tPlan, change.plan), interval: t(`interval.${change.interval}`) })}
                    footer={
                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button type="button" onClick={() => setChange(null)} className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:bg-subtle">
                                {tPage("changeDialog.back")}
                            </button>
                            <button type="button" onClick={confirmChange} aria-disabled={action.busy} className="inline-flex items-center justify-center gap-2 rounded-full bg-inverse px-5 py-2.5 text-sm font-semibold text-on-inverse hover:bg-accent hover:text-on-accent aria-disabled:opacity-60">
                                {action.busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
                                {tPage("changeDialog.confirm")}
                            </button>
                        </div>
                    }
                >
                    <div className="space-y-3 text-sm text-ink-muted">
                        {change.kind === "upgrade" ? (
                            <>
                                <p>{tPage("changeDialog.upgradeBody")}</p>
                                {change.estimate !== null && (
                                    <p className="rounded-2xl bg-subtle px-4 py-3 text-ink">
                                        {tPage("changeDialog.estimate", { amount: exactMoney(change.estimate) })}
                                    </p>
                                )}
                                <p>{tPage("changeDialog.upgradeRenews", { amount: exactMoney(amountOf(change.plan, change.interval)), interval: t(`interval.${change.interval}`).toLowerCase() })}</p>
                            </>
                        ) : (
                            <p>{tPage("changeDialog.downgradeBody", {
                                current: planLabel(tPlan, currentPlan),
                                date: date(subscription.renewsAt),
                                plan: planLabel(tPlan, change.plan),
                                interval: t(`interval.${change.interval}`).toLowerCase(),
                                amount: exactMoney(amountOf(change.plan, change.interval)),
                            })}</p>
                        )}
                        {action.error && <p role="alert" className="font-semibold text-danger">{action.error}</p>}
                    </div>
                </Modal>
            )}
        </div>
    );
}
