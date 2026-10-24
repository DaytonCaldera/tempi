"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, Minus } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { planLabel } from "@/i18n/labels";
import { PLAN_FEATURES } from "@/lib/constants";
import type { PlanSummary } from "@/lib/plans";

export type BillingInterval = "monthly" | "yearly";

interface PricingTableProps {
    plans: PlanSummary[];
    /**
     * "public": the free plan leads to sign-in, paid plans to /checkout, which signs up and pays (/pricing and the home page).
     * "admin": paid plans start a checkout for the organization (the /admin/plan page).
     */
    mode: "public" | "admin";
    /** The organization's effective plan, marked as current (admin mode) */
    currentPlanId?: string | null;
}

/** Plan cards with a monthly/yearly switch. Limits of null are unlimited (lib/plans.ts). */
export default function PricingTable({ plans, mode, currentPlanId }: PricingTableProps) {
    const t = useTranslations("pricing");
    const tPlan = useTranslations("plan");
    const format = useFormatter();
    const [interval, setBillingInterval] = useState<BillingInterval>("monthly");
    const [buying, setBuying] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const hasYearly = plans.some(p => p.priceYearly > 0);

    const money = (value: number) => format.number(value, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
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
                    const isCurrent = mode === "admin" && plan._id === currentPlanId;
                    const highlighted = plan.key === "pro";
                    const yearly = interval === "yearly" && plan.priceYearly > 0;
                    const price = yearly ? plan.priceYearly : plan.price;
                    const rows = [
                        { label: t("rows.users", { value: limit(plan.limits.users) }), included: true },
                        { label: t("rows.departments", { value: limit(plan.limits.departments) }), included: true },
                        { label: t("rows.items", { value: limit(plan.limits.items) }), included: true },
                        { label: plan.historyDays ? t("rows.history", { days: plan.historyDays }) : t("rows.historyFull"), included: true },
                        { label: t("rows.runner"), included: true },
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
                                    <Link href={plan.price > 0 && plan.purchasable ? `/checkout?${new URLSearchParams({ plan: plan._id, interval: yearly ? "yearly" : "monthly" })}` : "/login"} className={`block w-full rounded-full py-3 text-center text-sm font-semibold transition ${highlighted ? "bg-accent text-on-accent hover:brightness-110" : "bg-inverse text-on-inverse hover:bg-accent hover:text-on-accent"}`}>
                                        {price > 0 ? t("start") : t("startFree")}
                                    </Link>
                                ) : isCurrent ? (
                                    <p className="w-full rounded-full border border-line py-3 text-center text-sm font-semibold text-ink-muted">{t("current")}</p>
                                ) : plan.price > 0 && plan.purchasable ? (
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
        </div>
    );
}
