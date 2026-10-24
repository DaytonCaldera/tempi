import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import PlanForm from "@/components/superadmin/PlanForm";
import { PageHeader } from "@/components/superadmin/ui";
import { planLabel } from "@/i18n/labels";
import { toObjectId } from "@/lib/api";
import { getPlanForAdmin, listOpenOrganizations, listPlansForAdmin } from "@/lib/plan-admin";
import { requireSuperadmin } from "@/lib/superadmin";

/**
 * Edits a plan, or creates a custom plan (/superadmin/plans/new?clientId=). A new plan starts from Business's
 * values, the usual starting point for a large organization.
 */
export default async function SuperadminPlanPage({ params, searchParams }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ clientId?: string }>;
}) {
    await requireSuperadmin();
    const [{ id }, { clientId }, t, tPlan] = await Promise.all([params, searchParams, getTranslations("superadmin.plans"), getTranslations("plan")]);
    const isNew = id === "new";

    const planId = isNew ? null : toObjectId(id);
    if (!isNew && !planId) notFound();
    const plan = planId ? await getPlanForAdmin(planId) : null;
    if (!isNew && !plan) notFound();

    const [organizations, base] = isNew
        ? await Promise.all([listOpenOrganizations(), listPlansForAdmin().then(plans => plans.find(p => p.key === "business") ?? null)])
        : [[], null];

    return (
        <>
            <Link href="/superadmin/plans" className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-ink-subtle hover:text-ink">
                <ArrowLeft size={14} aria-hidden /> {t("back")}
            </Link>
            <PageHeader
                title={plan ? planLabel(tPlan, plan) : t("newCustom")}
                subtitle={plan ? (plan.isCustom ? `${t("customFor")} ${plan.owner?.name ?? "—"}` : t("catalogHint")) : t("newHint")}
            />
            <PlanForm
                plan={plan}
                base={base}
                organizations={organizations}
                defaultClientId={clientId ?? null}
            />
        </>
    );
}
