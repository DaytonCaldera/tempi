'use client';
import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArchiveRestore, CheckCircle2, CreditCard, KeyRound, UserCog, Wrench } from "lucide-react";
import { SUPPORT_REASON_MIN_LENGTH } from "@/lib/constants";
import {
    changePlan, regenerateJoinCode, repairStock, restoreClosedOrganization, transferOwnership, type RepairState, type ToolState,
} from "@/app/(superadmin)/superadmin/organizations/[id]/actions";

type Candidate = { _id: string; name: string; email: string };
type PlanOption = { _id: string; name: string; price: number; limits: { users: number | null; departments: number | null; items: number | null } };

const input = "w-full rounded-2xl border border-line bg-subtle px-4 py-3 text-sm text-ink outline-none focus:border-line-strong";
const label = "mb-1 block text-xs font-semibold text-ink-muted";

/**
 * The superadmin's support tools on an organization's page: a new join code, and transferring ownership.
 * Buttons are never disabled and fields have no native validation: every click reaches the server action,
 * which validates and answers with a message, so a click always shows something.
 */
export default function OrganizationTools({ clientId, name, candidates, plans, currentPlanId }: {
    clientId: string; name: string; candidates: Candidate[]; plans: PlanOption[]; currentPlanId: string | null;
}) {
    const t = useTranslations("superadmin.tools");

    return (
        <section className="rounded-3xl border border-line bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold text-ink">{t("title")}</h2>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <ChangePlan clientId={clientId} plans={plans} currentPlanId={currentPlanId} />
                <RegenerateCode clientId={clientId} />
                <TransferOwnership clientId={clientId} name={name} candidates={candidates} />
                <RepairStock clientId={clientId} />
            </div>
        </section>
    );
}

function Reason({ id }: { id: string }) {
    const t = useTranslations("superadmin.tools");
    return (
        <div>
            <label htmlFor={id} className={label}>{t("reason")}</label>
            <textarea id={id} name="reason" maxLength={500} rows={2} placeholder={t("reasonPlaceholder")} className={input} />
            <p className="mt-1 text-[11px] text-ink-subtle">{t("reasonTooShort", { min: SUPPORT_REASON_MIN_LENGTH })}</p>
        </div>
    );
}

function Result({ state, done, pending }: { state: ToolState; done: string; pending: boolean }) {
    const t = useTranslations("superadmin.tools");
    if (pending) return <p role="status" className="text-sm text-ink-muted">{t("processing")}</p>;
    if (state.error) {
        const message = state.error === "reasonTooShort" ? t("reasonTooShort", { min: SUPPORT_REASON_MIN_LENGTH }) : t(`errors.${state.error}`);
        return <p role="alert" className="text-sm font-semibold text-danger">{message}</p>;
    }
    if (state.ok) return <p role="status" className="flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 size={16} aria-hidden /> {done}</p>;
    return null;
}

function RegenerateCode({ clientId }: { clientId: string }) {
    const t = useTranslations("superadmin.tools.regenerate");
    const [state, action, pending] = useActionState(regenerateJoinCode, {});

    return (
        <form action={action} className="flex flex-col gap-3 rounded-2xl border border-line p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><KeyRound size={16} aria-hidden /> {t("title")}</h3>
            <p className="text-xs text-ink-muted">{t("description")}</p>
            <input type="hidden" name="clientId" value={clientId} />
            <Reason id="regenerate-reason" />
            <button type="submit" aria-disabled={pending} className="self-start rounded-2xl bg-inverse px-5 py-2.5 text-xs font-semibold text-on-inverse aria-disabled:opacity-50">{t("button")}</button>
            <Result state={state} pending={pending} done={t("done", { code: state.code ?? "" })} />
        </form>
    );
}

function TransferOwnership({ clientId, name, candidates }: { clientId: string; name: string; candidates: Candidate[] }) {
    const t = useTranslations("superadmin.tools.transfer");
    const [state, action, pending] = useActionState(transferOwnership, {});

    return (
        <form action={action} className="flex flex-col gap-3 rounded-2xl border border-line p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><UserCog size={16} aria-hidden /> {t("title")}</h3>
            <p className="text-xs text-ink-muted">{t("description")}</p>
            {candidates.length === 0 ? <p className="text-sm text-ink-muted">{t("noCandidates")}</p> : (
                <>
                    <input type="hidden" name="clientId" value={clientId} />
                    <div>
                        <label htmlFor="transfer-user" className={label}>{t("member")}</label>
                        <select id="transfer-user" name="userId" defaultValue="" className={input}>
                            <option value="">{t("pick")}</option>
                            {candidates.map(c => <option key={c._id} value={c._id}>{c.name} · {c.email}</option>)}
                        </select>
                    </div>
                    <Reason id="transfer-reason" />
                    <div>
                        <label htmlFor="transfer-confirm" className={label}>{t("confirm", { name })}</label>
                        <input id="transfer-confirm" name="confirmName" autoComplete="off" className={input} />
                    </div>
                    <button type="submit" aria-disabled={pending} className="self-start rounded-2xl bg-danger px-5 py-2.5 text-xs font-semibold text-canvas aria-disabled:opacity-40">{t("button")}</button>
                    <Result state={state} pending={pending} done={t("done", { name: state.name ?? "" })} />
                </>
            )}
        </form>
    );
}

/** Preview, then repair, the stock history of the organization's items (lib/stock-repair.ts). */
function RepairStock({ clientId }: { clientId: string }) {
    const t = useTranslations("superadmin.tools.repair");
    const [state, action, pending] = useActionState<RepairState, FormData>(repairStock, {});
    const preview = state.preview;
    const hasWork = (preview?.items ?? 0) > 0;

    return (
        <form action={action} className="flex flex-col gap-3 rounded-2xl border border-line p-5 xl:col-span-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><Wrench size={16} aria-hidden /> {t("title")}</h3>
            <p className="text-xs text-ink-muted">{t("description")}</p>
            <input type="hidden" name="clientId" value={clientId} />

            {preview && (preview.items === 0 ? (
                <p role="status" className="flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 size={16} aria-hidden /> {t("nothingToDo")}</p>
            ) : (
                <div className="rounded-2xl bg-subtle p-4 text-sm">
                    <p className="font-semibold text-ink">{t("summary", { items: preview.items, missing: preview.missing, sync: preview.sync })}</p>
                    <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-ink-muted">
                        {preview.sample.map(item => (
                            <li key={`${item.sku}-${item.departmentName}`}>{item.productName} ({item.sku}) · {item.departmentName} — {t("itemDetail", { missing: item.missing, sync: item.sync })}</li>
                        ))}
                    </ul>
                </div>
            ))}
            {hasWork && <Reason id="repair-reason" />}

            <div className="flex flex-wrap gap-2">
                <button type="submit" name="intent" value="preview" aria-disabled={pending} className="rounded-2xl border border-line px-5 py-2.5 text-xs font-semibold text-ink hover:border-line-strong aria-disabled:opacity-50">{t("preview")}</button>
                {hasWork && (
                    <button type="submit" name="intent" value="apply" aria-disabled={pending} className="rounded-2xl bg-inverse px-5 py-2.5 text-xs font-semibold text-on-inverse aria-disabled:opacity-50">{t("apply")}</button>
                )}
            </div>
            <Result state={state} pending={pending} done={state.applied ? t("done", { items: state.applied.items, inserted: state.applied.inserted, archived: state.applied.archived }) : ""} />
        </form>
    );
}

/** On a closed organization's page: reopens it and gives the members back their access. */
export function RestoreOrganization({ clientId, name, savedMembers }: { clientId: string; name: string; savedMembers: number | null }) {
    const t = useTranslations("superadmin.tools.restore");
    const [state, action, pending] = useActionState(restoreClosedOrganization, {});

    return (
        <section className="rounded-3xl border border-line bg-card p-6">
            <form action={action} className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><ArchiveRestore size={16} aria-hidden /> {t("title")}</h2>
                <p className="text-xs text-ink-muted">{savedMembers === null ? t("descriptionOwnerOnly") : t("description", { count: savedMembers })}</p>
                <input type="hidden" name="clientId" value={clientId} />
                <Reason id="restore-reason" />
                <div>
                    <label htmlFor="restore-confirm" className={label}>{t("confirm", { name })}</label>
                    <input id="restore-confirm" name="confirmName" autoComplete="off" className={input} />
                </div>
                <button type="submit" aria-disabled={pending} className="self-start rounded-2xl bg-inverse px-5 py-2.5 text-xs font-semibold text-on-inverse aria-disabled:opacity-50">{t("button")}</button>
                <Result state={state} pending={pending} done={t("done", { count: state.restored ?? 0, code: state.code ?? "" })} />
            </form>
        </section>
    );
}

/** Moves the organization to another plan (its limits apply from the next action, see lib/plans.ts). */
function ChangePlan({ clientId, plans, currentPlanId }: { clientId: string; plans: PlanOption[]; currentPlanId: string | null }) {
    const t = useTranslations("superadmin.tools.plan");
    const [state, action, pending] = useActionState(changePlan, {});
    const limit = (value: number | null) => value ?? "∞";

    return (
        <form action={action} className="flex flex-col gap-3 rounded-2xl border border-line p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><CreditCard size={16} aria-hidden /> {t("title")}</h3>
            <p className="text-xs text-ink-muted">{t("description")}</p>
            <input type="hidden" name="clientId" value={clientId} />
            <div>
                <label htmlFor="plan-id" className={label}>{t("plan")}</label>
                <select id="plan-id" name="planId" defaultValue={currentPlanId ?? ""} className={input}>
                    <option value="">{t("pick")}</option>
                    {plans.map(plan => (
                        <option key={plan._id} value={plan._id}>
                            {plan.name} · {t("limits", { users: limit(plan.limits.users), departments: limit(plan.limits.departments), items: limit(plan.limits.items) })}
                        </option>
                    ))}
                </select>
            </div>
            <Reason id="plan-reason" />
            <div className="flex flex-wrap items-center gap-3">
                <button type="submit" aria-disabled={pending} className="rounded-2xl bg-inverse px-5 py-2.5 text-xs font-semibold text-on-inverse aria-disabled:opacity-50">{t("button")}</button>
                <Link href={`/superadmin/plans/new?clientId=${clientId}`} className="text-xs font-semibold text-accent hover:underline">{t("custom")}</Link>
            </div>
            <Result state={state} pending={pending} done={t("done", { name: state.name ?? "" })} />
        </form>
    );
}
