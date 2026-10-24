import Link from "next/link";
import { Plus } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, PageHeader } from "@/components/superadmin/ui";
import { DataTable, DataTableCell, DataTableRow } from "@/components/ui/DataTable";
import { featureLabel, planLabel } from "@/i18n/labels";
import { listPlansForAdmin } from "@/lib/plan-admin";
import { requireSuperadmin } from "@/lib/superadmin";

/** Every plan: the catalog (Free, Pro, Business) and the custom plans made for one organization. */
export default async function SuperadminPlansPage() {
    await requireSuperadmin();
    const [t, tPlan, tPricing, format, plans] = await Promise.all([
        getTranslations("superadmin.plans"), getTranslations("plan"), getTranslations("pricing"), getFormatter(), listPlansForAdmin(),
    ]);
    const money = (value: number) => format.number(value, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
    const limit = (value: number | null) => value === null ? "∞" : format.number(value);

    return (
        <>
            <PageHeader title={t("title")} subtitle={t("subtitle")}>
                <Link href="/superadmin/plans/new" className="inline-flex items-center gap-2 rounded-2xl bg-inverse px-4 py-2.5 text-xs font-semibold text-on-inverse">
                    <Plus size={14} aria-hidden /> {t("newCustom")}
                </Link>
            </PageHeader>

            <DataTable headers={["plan", "price", "limits", "history", "features", "organizations", "status"].map(key => ({ title: t(`columns.${key}`) }))}>
                {plans.map(plan => (
                    <DataTableRow key={plan._id}>
                        <DataTableCell>
                            <Link href={`/superadmin/plans/${plan._id}`} className="font-semibold text-ink hover:text-accent">{planLabel(tPlan, plan)}</Link>
                            <p className="text-[11px] text-ink-subtle">
                                {plan.isCustom
                                    ? <>{t("customFor")} {plan.owner ? <Link href={`/superadmin/organizations/${plan.owner._id}`} className="hover:text-accent">{plan.owner.name}</Link> : "—"}</>
                                    : t("catalog")}
                            </p>
                        </DataTableCell>
                        <DataTableCell className="whitespace-nowrap tabular-nums">
                            {plan.price > 0 ? money(plan.price) : tPricing("free")}
                            {plan.priceYearly > 0 && <p className="text-[11px] text-ink-subtle">{money(plan.priceYearly)} {tPricing("perYear")}</p>}
                            {plan.billingMode === "manual" && <p className="text-[11px] text-ink-subtle">{t("manual")}</p>}
                        </DataTableCell>
                        <DataTableCell className="whitespace-nowrap text-xs text-ink-muted">
                            {t("limits", { users: limit(plan.limits.users), departments: limit(plan.limits.departments), items: limit(plan.limits.items) })}
                        </DataTableCell>
                        <DataTableCell className="whitespace-nowrap text-xs text-ink-muted">{plan.historyDays ? t("days", { days: plan.historyDays }) : t("fullHistory")}</DataTableCell>
                        <DataTableCell className="text-xs text-ink-muted">{plan.features.length ? plan.features.map(f => featureLabel(tPricing, f)).join(" · ") : "—"}</DataTableCell>
                        <DataTableCell className="tabular-nums">{format.number(plan.organizations)}</DataTableCell>
                        <DataTableCell><Badge tone={plan.isActive ? "success" : "neutral"}>{t(plan.isActive ? "active" : "inactive")}</Badge></DataTableCell>
                    </DataTableRow>
                ))}
            </DataTable>
            <p className="mt-4 text-xs text-ink-subtle">{t("hint")}</p>
        </>
    );
}
