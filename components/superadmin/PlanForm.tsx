'use client';
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { PLAN_FEATURES, SUPPORT_REASON_MIN_LENGTH } from "@/lib/constants";
import type { AdminPlanRow } from "@/lib/plan-admin";
import { savePlan, type PlanFormState } from "@/app/(superadmin)/superadmin/plans/actions";

const input = "w-full rounded-2xl border border-line bg-subtle px-4 py-3 text-sm text-ink outline-none focus:border-line-strong";
const label = "mb-1 block text-xs font-semibold text-ink-muted";

/**
 * Create/edit form of a plan (savePlan). "Preview" shows which organizations a change would leave over a
 * limit before anything is saved. Like the other support tools, buttons are never disabled: the server
 * validates and always answers with a message.
 */
export default function PlanForm({ plan, base, organizations, defaultClientId }: {
    /** The plan being edited, or null for a new custom plan */
    plan: AdminPlanRow | null;
    /** Values a new plan starts from */
    base: AdminPlanRow | null;
    /** Open organizations to pick from, for a new plan */
    organizations: { _id: string; name: string }[];
    defaultClientId: string | null;
}) {
    const t = useTranslations("superadmin.plans");
    const tTools = useTranslations("superadmin.tools");
    const tPricing = useTranslations("pricing");
    const tResources = useTranslations("plan.resources");
    const router = useRouter();
    const [state, action, pending] = useActionState<PlanFormState, FormData>(savePlan, {});
    const values = plan ?? base;
    const isCatalog = !!plan && !plan.isCustom;

    // A new plan moves to its own page once saved
    useEffect(() => {
        if (state.ok && state.planId && !plan) router.push(`/superadmin/plans/${state.planId}`);
    }, [state, plan, router]);

    const number = (name: string, value: number | null | undefined, hint?: string, step = "1") => (
        <div>
            <label htmlFor={`plan-${name}`} className={label}>{t(`fields.${name}`)}</label>
            <input id={`plan-${name}`} name={name} type="number" min={0} step={step} defaultValue={value ?? 0} className={input} />
            {hint && <p className="mt-1 text-[11px] text-ink-subtle">{hint}</p>}
        </div>
    );

    return (
        <form action={action} className="flex flex-col gap-6">
            {plan && <input type="hidden" name="planId" value={plan._id} />}

            <section className="grid grid-cols-1 gap-4 rounded-3xl border border-line bg-card p-6 md:grid-cols-2">
                {!plan && (
                    <div className="md:col-span-2">
                        <label htmlFor="plan-clientId" className={label}>{t("fields.organization")}</label>
                        <select id="plan-clientId" name="clientId" defaultValue={defaultClientId ?? ""} className={input}>
                            <option value="">{t("pickOrganization")}</option>
                            {organizations.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
                        </select>
                        <label className="mt-3 flex items-center gap-2 text-sm text-ink">
                            <input type="checkbox" name="assign" defaultChecked /> {t("fields.assign")}
                        </label>
                    </div>
                )}
                <div className="md:col-span-2">
                    <label htmlFor="plan-name" className={label}>{t("fields.name")}</label>
                    <input id="plan-name" name="name" maxLength={60} defaultValue={plan?.name ?? ""} placeholder={t("namePlaceholder")} className={input} />
                    {isCatalog && <p className="mt-1 text-[11px] text-ink-subtle">{t("catalogNameHint")}</p>}
                </div>
                {number("price", values?.price, t("priceHint"), "0.01")}
                {number("priceYearly", values?.priceYearly, t("priceYearlyHint"), "0.01")}
            </section>

            <section className="grid grid-cols-1 gap-4 rounded-3xl border border-line bg-card p-6 md:grid-cols-2 xl:grid-cols-4">
                <h2 className="text-sm font-semibold text-ink md:col-span-2 xl:col-span-4">{t("limitsTitle")}</h2>
                {number("maxUsers", values?.limits.users, t("unlimitedHint"))}
                {number("maxDepartments", values?.limits.departments, t("unlimitedHint"))}
                {number("maxItems", values?.limits.items, t("unlimitedHint"))}
                {number("historyDays", values?.historyDays, t("historyHint"))}
            </section>

            <section className="grid grid-cols-1 gap-4 rounded-3xl border border-line bg-card p-6 md:grid-cols-2">
                <fieldset className="md:col-span-2">
                    <legend className={label}>{t("fields.features")}</legend>
                    <div className="flex flex-wrap gap-4">
                        {Object.values(PLAN_FEATURES).map(feature => (
                            <label key={feature} className="flex items-center gap-2 text-sm text-ink">
                                <input type="checkbox" name="features" value={feature} defaultChecked={values?.features.includes(feature)} />
                                {tPricing(`features.${feature}`)}
                            </label>
                        ))}
                    </div>
                </fieldset>
                <div>
                    <label htmlFor="plan-billingMode" className={label}>{t("fields.billingMode")}</label>
                    <select id="plan-billingMode" name="billingMode" defaultValue={plan?.billingMode ?? "manual"} className={input}>
                        <option value="lemonsqueezy">{t("billing.lemonsqueezy")}</option>
                        <option value="manual">{t("billing.manual")}</option>
                    </select>
                </div>
                {plan && (
                    <div>
                        <label htmlFor="plan-isActive" className={label}>{t("fields.status")}</label>
                        <select id="plan-isActive" name="isActive" defaultValue={plan.isActive ? "on" : "off"} className={input}>
                            <option value="on">{t("active")}</option>
                            <option value="off">{t("inactive")}</option>
                        </select>
                    </div>
                )}
                {isCatalog && (
                    <>
                        <div>
                            <label htmlFor="plan-monthlyVariantId" className={label}>{t("fields.monthlyVariantId")}</label>
                            <input id="plan-monthlyVariantId" name="monthlyVariantId" inputMode="numeric" defaultValue={plan.billing.monthlyVariantId ?? ""} className={input} />
                        </div>
                        <div>
                            <label htmlFor="plan-yearlyVariantId" className={label}>{t("fields.yearlyVariantId")}</label>
                            <input id="plan-yearlyVariantId" name="yearlyVariantId" inputMode="numeric" defaultValue={plan.billing.yearlyVariantId ?? ""} className={input} />
                        </div>
                    </>
                )}
                <div className="md:col-span-2">
                    <label htmlFor="plan-notes" className={label}>{t("fields.notes")}</label>
                    <textarea id="plan-notes" name="notes" rows={3} maxLength={1000} defaultValue={plan?.notes ?? ""} placeholder={t("notesPlaceholder")} className={input} />
                </div>
            </section>

            <section className="flex flex-col gap-4 rounded-3xl border border-line bg-card p-6">
                <div>
                    <label htmlFor="plan-reason" className={label}>{tTools("reason")}</label>
                    <textarea id="plan-reason" name="reason" maxLength={500} rows={2} placeholder={tTools("reasonPlaceholder")} className={input} />
                    <p className="mt-1 text-[11px] text-ink-subtle">{tTools("reasonTooShort", { min: SUPPORT_REASON_MIN_LENGTH })}</p>
                </div>

                {state.impact && (
                    <div role="status" className="rounded-2xl bg-subtle p-4 text-sm">
                        <p className="font-semibold text-ink">{t("impact.organizations", { count: state.impact.organizations })}</p>
                        {state.impact.over.length === 0 ? (
                            <p className="mt-1 text-ink-muted">{t("impact.noneOver")}</p>
                        ) : (
                            <>
                                <p className="mt-1 flex items-center gap-2 text-warning"><AlertTriangle size={14} aria-hidden /> {t("impact.over", { count: state.impact.over.length })}</p>
                                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-ink-muted">
                                    {state.impact.over.map(org => (
                                        <li key={org._id}>
                                            {org.name}: {org.resources.map(r => `${tResources(r.resource)} ${r.used}/${r.limit}`).join(" · ")}
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap gap-2">
                    <button type="submit" name="intent" value="preview" aria-disabled={pending} className="rounded-2xl border border-line px-5 py-2.5 text-xs font-semibold text-ink hover:border-line-strong aria-disabled:opacity-50">{t("preview")}</button>
                    <button type="submit" name="intent" value="save" aria-disabled={pending} className="rounded-2xl bg-inverse px-5 py-2.5 text-xs font-semibold text-on-inverse aria-disabled:opacity-50">{plan ? t("save") : t("create")}</button>
                </div>

                {pending ? <p role="status" className="text-sm text-ink-muted">{tTools("processing")}</p>
                    : state.error ? (
                        <p role="alert" className="text-sm font-semibold text-danger">
                            {state.error === "reasonTooShort" ? tTools("reasonTooShort", { min: SUPPORT_REASON_MIN_LENGTH }) : t(`errors.${state.error}`)}
                        </p>
                    ) : state.ok ? (
                        <p role="status" className="flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 size={16} aria-hidden /> {t("saved")}</p>
                    ) : null}
            </section>
        </form>
    );
}
