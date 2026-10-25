import { REFUND_GUARANTEE_DAYS } from "@/lib/constants";
import type { ScheduledChange, Subscription } from "@/types/models";

/**
 * How a paid subscription moves between plans and intervals (pure functions, tested in subscription-changes.test.ts):
 * - Upgrade (a pricier plan, or the same plan from monthly to yearly): right away and prorated. The organization
 *   pays today the new price minus the unused part of what it already paid, and the new period starts today.
 * - Downgrade (a cheaper plan, or the same plan from yearly to monthly): at the end of the paid period, with no
 *   refund. Until then it keeps what it paid for (Subscription.scheduledChange).
 * - Cancelling keeps the plan until the end of the period. A yearly payment is refunded in full when the
 *   organization cancels within REFUND_GUARANTEE_DAYS of it; monthly payments aren't refunded.
 */

export type Interval = "monthly" | "yearly";
export type ChangeKind = "upgrade" | "downgrade" | "none";

type PlanSide = { planId: string; price: number; interval: Interval };

/** Whether going from one plan and interval to another is an upgrade, a downgrade or no change. */
export function classifyChange(from: PlanSide, to: PlanSide): ChangeKind {
    if (from.planId === to.planId) {
        if (from.interval === to.interval) return "none";
        return to.interval === "yearly" ? "upgrade" : "downgrade";
    }
    // Plans are ranked by their monthly price, whatever interval each side pays
    return to.price > from.price ? "upgrade" : "downgrade";
}

/** The period that ends at `renewsAt`: one month or one year before it, by the calendar. */
export function periodStart(renewsAt: Date, interval: Interval) {
    const start = new Date(renewsAt);
    if (interval === "yearly") start.setUTCFullYear(start.getUTCFullYear() - 1);
    else start.setUTCMonth(start.getUTCMonth() - 1);
    return start;
}

/**
 * About what an upgrade charges today: the new price minus the unused share of the current one (both for their own
 * interval, before taxes). Lemon Squeezy computes the real amount; this is only shown before confirming.
 */
export function estimateUpgradeCharge({ currentAmount, newAmount, interval, renewsAt, now = new Date() }: {
    currentAmount: number; newAmount: number; interval: Interval; renewsAt: Date | null; now?: Date;
}) {
    if (!renewsAt) return Math.max(0, round(newAmount));
    const start = periodStart(renewsAt, interval).getTime();
    const length = renewsAt.getTime() - start;
    const unusedShare = length > 0 ? Math.min(1, Math.max(0, (renewsAt.getTime() - now.getTime()) / length)) : 0;
    return Math.max(0, round(newAmount - currentAmount * unusedShare));
}

const round = (value: number) => Math.round(value * 100) / 100;

const DAY = 24 * 60 * 60 * 1000;

/**
 * Whether cancelling now refunds the latest payment: it was for a yearly interval, it charged something and it was
 * made less than REFUND_GUARANTEE_DAYS ago.
 */
export function refundEligible(
    subscription: Pick<Subscription, "status" | "interval" | "refundedAt"> | null | undefined,
    invoice: { total: number; createdAt: Date } | null,
    now = new Date()
) {
    if (!subscription || !invoice || subscription.refundedAt) return false;
    if (subscription.status !== "active" && subscription.status !== "cancelled") return false;
    if (subscription.interval !== "yearly" || !(invoice.total > 0)) return false;
    const age = now.getTime() - new Date(invoice.createdAt).getTime();
    return age >= 0 && age < REFUND_GUARANTEE_DAYS * DAY;
}

/** Last day of the refund guarantee of a payment. */
export const refundDeadline = (paidAt: Date) => new Date(new Date(paidAt).getTime() + REFUND_GUARANTEE_DAYS * DAY);

/** A scheduled change that hasn't reached its date yet. */
export const pendingChange = (change: ScheduledChange | null | undefined, now = new Date()) =>
    change && new Date(change.at) > now ? change : null;

/**
 * The plan and interval the subscription gives now: what was paid for (`from`) while a downgrade is pending, else
 * its own.
 */
export function subscriptionTerms(subscription: Pick<Subscription, "planId" | "interval" | "scheduledChange">, now = new Date()) {
    const pending = pendingChange(subscription.scheduledChange, now);
    if (pending) return { planId: pending.from.planId, interval: pending.from.interval };
    return { planId: subscription.planId, interval: subscription.interval ?? "monthly" as Interval };
}

/** Hours before the end of the period at which the daily job moves Lemon Squeezy to the new interval. */
export const SCHEDULED_CHANGE_LEAD_HOURS = 36;

/**
 * What the daily job does with a change that isn't applied yet: "apply" it when the period ends within
 * SCHEDULED_CHANGE_LEAD_HOURS, "drop" it once the period ended (Lemon Squeezy already renewed the old variant, which
 * was paid for), or "wait".
 */
export function scheduledChangeAction(change: ScheduledChange | null | undefined, now = new Date()): "apply" | "drop" | "wait" {
    if (!change || change.applied) return "wait";
    const left = new Date(change.at).getTime() - now.getTime();
    if (left <= 0) return "drop";
    return left <= SCHEDULED_CHANGE_LEAD_HOURS * 60 * 60 * 1000 ? "apply" : "wait";
}
