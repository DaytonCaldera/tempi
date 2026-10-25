"use client";
import { useState } from "react";
import { CalendarClock, CheckCircle2, ExternalLink, Loader2, Receipt } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { REFUND_GUARANTEE_DAYS } from "@/lib/constants";
import type { Interval } from "@/lib/subscription-changes";
import type { SubscriptionStatus } from "@/types/models";
import { useSubscriptionAction } from "./useSubscriptionAction";

/** The subscription as /admin/plan shows it (app/(dashboard)/admin/plan/page.tsx). */
export type SubscriptionView = {
    status: SubscriptionStatus;
    /** Whether it is what gives the organization its plan (lib/plans.ts subscriptionGivesAccess) */
    givesAccess: boolean;
    /** What is paid now (while a downgrade is pending, the plan and interval already paid) */
    planName: string;
    interval: Interval;
    renewsAt: string | null;
    endsAt: string | null;
    portalUrl: string | null;
    refunded: boolean;
    scheduledChange: { planName: string; interval: Interval; at: string } | null;
    /** Set while cancelling refunds the latest yearly payment (lib/subscription-changes.ts refundEligible) */
    refund: { amount: number; deadline: string } | null;
    /** Only the owner can change, cancel or resume it (app/api/billing/subscription) */
    isOwner: boolean;
};

/**
 * The organization's paid subscription: what it pays and when, a pending downgrade, and cancelling or resuming it.
 * Cancelling keeps the plan until the end of the period; within the yearly guarantee it can refund instead.
 */
export default function SubscriptionPanel({ subscription }: { subscription: SubscriptionView }) {
    const t = useTranslations("plan.page");
    const tPricing = useTranslations("pricing");
    const format = useFormatter();
    const { run, busy, error, clearError } = useSubscriptionAction();
    const [dialog, setDialog] = useState<"cancel" | "refund" | null>(null);
    const [refund, setRefund] = useState(false);
    const [done, setDone] = useState<string | null>(null);

    const date = (value: string | null) => value ? format.dateTime(new Date(value), { dateStyle: "long" }) : "—";
    const money = (value: number) => format.number(value, { style: "currency", currency: "USD" });
    const { status, refunded, scheduledChange, isOwner, givesAccess } = subscription;
    const cancelled = status === "cancelled";
    const canCancel = isOwner && givesAccess && !cancelled;
    const canResume = isOwner && cancelled && !refunded && !!subscription.endsAt && new Date(subscription.endsAt) > new Date();
    const canRefund = isOwner && !!subscription.refund;

    const openDialog = (kind: "cancel" | "refund") => {
        clearError();
        setRefund(kind === "refund");
        setDialog(kind);
    };

    const act = async (body: Record<string, unknown>, message: (data: Record<string, unknown>) => string) => {
        if (busy) return;
        setDone(null);
        const data = await run(body);
        if (data) {
            setDialog(null);
            setDone(message(data));
        }
    };

    return (
        <section className="mb-10 rounded-3xl border border-line bg-card p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                    <Receipt size={20} className="mt-0.5 text-accent" aria-hidden />
                    <div className="text-sm">
                        <p className="font-semibold text-ink">{refunded ? t("refundedTitle") : t(`subscription.${status}`)}</p>
                        {givesAccess && <p className="text-ink">{t("paying", { plan: subscription.planName, interval: tPricing(`interval.${subscription.interval}`) })}</p>}
                        <p className="text-ink-muted">
                            {refunded ? t("refundedBody")
                                : cancelled ? t("endsOn", { date: date(subscription.endsAt) })
                                : subscription.renewsAt ? t("renewsOn", { date: date(subscription.renewsAt) }) : null}
                        </p>
                        {canRefund && cancelled && (
                            <p className="mt-1 text-ink-muted">{t("refundStillAvailable", { days: REFUND_GUARANTEE_DAYS, date: date(subscription.refund!.deadline) })}</p>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {canResume && (
                        <button type="button" onClick={() => act({ action: "resume" }, () => t("resumed"))} aria-disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-inverse px-5 py-2.5 text-sm font-semibold text-on-inverse hover:bg-accent hover:text-on-accent aria-disabled:opacity-60">
                            {busy && <Loader2 size={14} className="animate-spin" aria-hidden />} {t("resume")}
                        </button>
                    )}
                    {canRefund && cancelled && (
                        <button type="button" onClick={() => openDialog("refund")} className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:border-line-strong">
                            {t("requestRefund")}
                        </button>
                    )}
                    {subscription.portalUrl && !refunded && (
                        <a href={subscription.portalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:border-line-strong">
                            {t("manage")} <ExternalLink size={14} aria-hidden />
                        </a>
                    )}
                    {canCancel && (
                        <button type="button" onClick={() => openDialog("cancel")} className="rounded-full px-5 py-2.5 text-sm font-semibold text-danger hover:bg-danger/10">
                            {t("cancel")}
                        </button>
                    )}
                </div>
            </div>

            {scheduledChange && (
                <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-line bg-subtle px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
                    <p className="flex items-start gap-2 text-ink">
                        <CalendarClock size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                        {t("scheduledChange", { plan: scheduledChange.planName, interval: tPricing(`interval.${scheduledChange.interval}`), date: date(scheduledChange.at) })}
                    </p>
                    {isOwner && (
                        <button type="button" onClick={() => act({ action: "keepCurrent" }, () => t("keptCurrent"))} aria-disabled={busy} className="self-start whitespace-nowrap rounded-full border border-line bg-card px-4 py-2 text-xs font-semibold text-ink hover:border-line-strong aria-disabled:opacity-60 md:self-auto">
                            {t("keepCurrent")}
                        </button>
                    )}
                </div>
            )}

            {!isOwner && <p className="mt-4 text-xs text-ink-subtle">{t("ownerOnly")}</p>}
            {done && (
                <p role="status" className="mt-4 flex items-center gap-2 text-sm text-ink">
                    <CheckCircle2 size={16} className="text-success" aria-hidden /> {done}
                </p>
            )}
            {error && !dialog && <p role="alert" className="mt-4 text-sm font-semibold text-danger">{error}</p>}

            <Modal
                isOpen={dialog !== null}
                onClose={() => setDialog(null)}
                title={dialog === "refund" ? t("cancelDialog.refundTitle") : t("cancelDialog.title")}
                footer={
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <button type="button" onClick={() => setDialog(null)} className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:bg-subtle">
                            {t("cancelDialog.keep")}
                        </button>
                        <button
                            type="button"
                            aria-disabled={busy}
                            onClick={() => act({ action: "cancel", refund }, data => data.refunded ? t("refundDone") : t("cancelledDone", { date: date(subscription.renewsAt) }))}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-danger px-5 py-2.5 text-sm font-semibold text-canvas hover:brightness-110 aria-disabled:opacity-60"
                        >
                            {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
                            {refund ? t("cancelDialog.confirmRefund") : t("cancelDialog.confirm")}
                        </button>
                    </div>
                }
            >
                <div className="space-y-4 text-sm text-ink-muted">
                    {dialog === "cancel" && subscription.refund ? (
                        <fieldset className="space-y-3">
                            <legend className="mb-2 text-ink">{t("cancelDialog.chooseHow")}</legend>
                            <label className="flex cursor-pointer gap-3 rounded-2xl border border-line p-3 has-checked:border-accent">
                                <input type="radio" name="cancel-mode" checked={!refund} onChange={() => setRefund(false)} className="mt-1 accent-accent" />
                                <span>
                                    <span className="block font-semibold text-ink">{t("cancelDialog.atPeriodEnd")}</span>
                                    {t("cancelDialog.body", { plan: subscription.planName, date: date(subscription.renewsAt) })}
                                </span>
                            </label>
                            <label className="flex cursor-pointer gap-3 rounded-2xl border border-line p-3 has-checked:border-accent">
                                <input type="radio" name="cancel-mode" checked={refund} onChange={() => setRefund(true)} className="mt-1 accent-accent" />
                                <span>
                                    <span className="block font-semibold text-ink">{t("cancelDialog.withRefund", { amount: money(subscription.refund.amount) })}</span>
                                    {t("cancelDialog.refundBody", { days: REFUND_GUARANTEE_DAYS, date: date(subscription.refund.deadline) })}
                                </span>
                            </label>
                        </fieldset>
                    ) : dialog === "refund" && subscription.refund ? (
                        <p>{t("cancelDialog.refundOnlyBody", { amount: money(subscription.refund.amount) })}</p>
                    ) : (
                        <>
                            <p>{t("cancelDialog.body", { plan: subscription.planName, date: date(subscription.renewsAt) })}</p>
                            <p>{subscription.interval === "yearly" ? t("cancelDialog.noRefundYearly", { days: REFUND_GUARANTEE_DAYS }) : t("cancelDialog.noRefundMonthly")}</p>
                        </>
                    )}
                    {scheduledChange && dialog === "cancel" && <p>{t("cancelDialog.dropsScheduled")}</p>}
                    {error && <p role="alert" className="font-semibold text-danger">{error}</p>}
                </div>
            </Modal>
        </section>
    );
}
