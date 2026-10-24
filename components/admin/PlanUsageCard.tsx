import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { planLabel } from "@/i18n/labels";
import type { PlanUsage } from "@/lib/plans";

/**
 * The organization's plan and how much of each limit it uses (lib/plans.ts), so admins see a limit coming
 * instead of meeting it as an error. Each meter's fill turns warning at 80% and danger when full;
 * the "x of y" text and the label say the same without the color.
 */
export default async function PlanUsageCard({ usage, title, upgradeLink = true }: {
    usage: PlanUsage;
    title?: string;
    /** Link to /admin/plan when a limit is close (the admin's pages; not the superadmin's) */
    upgradeLink?: boolean;
}) {
    const t = await getTranslations("plan");
    const format = await getFormatter();

    return (
        <section className="rounded-3xl border border-line bg-card p-6">
            <div className="mb-4 flex items-baseline justify-between gap-4">
                <h2 className="text-sm font-semibold text-ink">{title ?? t("title")}</h2>
                <p className="text-sm font-semibold text-accent">
                    {usage.plan ? planLabel(t, usage.plan) : t("noPlan")}
                    {usage.source === "trial" && usage.trialEndsAt && (
                        <span className="ml-2 text-xs font-medium text-ink-subtle">{t("trialUntil", { date: format.dateTime(new Date(usage.trialEndsAt), { dateStyle: "medium" }) })}</span>
                    )}
                </p>
            </div>
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {usage.resources.map(({ resource, used, limit }) => {
                    const share = limit ? used / limit : 0;
                    const fill = share >= 1 ? "bg-danger" : share >= 0.8 ? "bg-warning" : "bg-accent";
                    return (
                        <li key={resource}>
                            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                                <span className="text-ink-muted">{t(`resources.${resource}`)}</span>
                                <span className="font-semibold tabular-nums text-ink">
                                    {limit ? t("usage", { used: format.number(used), limit: format.number(limit) }) : `${format.number(used)} · ${t("unlimited")}`}
                                </span>
                            </div>
                            {limit && (
                                <div className="h-2 rounded-full bg-subtle" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} aria-label={t(`resources.${resource}`)}>
                                    <div className={`h-2 rounded-full ${fill}`} style={{ width: `${Math.min(100, Math.round(share * 100))}%` }} />
                                </div>
                            )}
                            {limit && share >= 1 && (
                                <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-danger">
                                    <AlertTriangle size={12} aria-hidden /> {used > limit ? t("over") : t("full")}
                                </p>
                            )}
                        </li>
                    );
                })}
            </ul>
            {upgradeLink && usage.resources.some(r => r.limit && r.used >= r.limit * 0.8) && (
                <Link href="/admin/plan" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                    {t("upgradeHint")} <ArrowRight size={12} aria-hidden />
                </Link>
            )}
        </section>
    );
}
