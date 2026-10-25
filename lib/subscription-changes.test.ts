import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import {
    classifyChange, estimateUpgradeCharge, pendingChange, periodStart, refundEligible, scheduledChangeAction, subscriptionTerms,
} from "@/lib/subscription-changes";
import type { ScheduledChange } from "@/types/models";

const pro = { planId: "pro", price: 19 };
const business = { planId: "business", price: 49 };

describe("classifyChange", () => {
    it("is no change for the same plan and interval", () => {
        expect(classifyChange({ ...pro, interval: "monthly" }, { ...pro, interval: "monthly" })).toBe("none");
    });

    it("upgrades from monthly to yearly and downgrades back", () => {
        expect(classifyChange({ ...pro, interval: "monthly" }, { ...pro, interval: "yearly" })).toBe("upgrade");
        expect(classifyChange({ ...pro, interval: "yearly" }, { ...pro, interval: "monthly" })).toBe("downgrade");
    });

    it("ranks plans by their monthly price, whatever the interval", () => {
        expect(classifyChange({ ...pro, interval: "yearly" }, { ...business, interval: "monthly" })).toBe("upgrade");
        expect(classifyChange({ ...business, interval: "monthly" }, { ...pro, interval: "yearly" })).toBe("downgrade");
    });
});

describe("periodStart", () => {
    it("goes back one month or one year by the calendar", () => {
        const renewsAt = new Date("2026-12-15T00:00:00Z");
        expect(periodStart(renewsAt, "monthly").toISOString()).toBe("2026-11-15T00:00:00.000Z");
        expect(periodStart(renewsAt, "yearly").toISOString()).toBe("2025-12-15T00:00:00.000Z");
    });
});

describe("estimateUpgradeCharge", () => {
    it("credits the unused share of the current period", () => {
        // Halfway through a 30-day month of Pro ($19), moving to Pro yearly ($190)
        const charge = estimateUpgradeCharge({
            currentAmount: 19, newAmount: 190, interval: "monthly",
            renewsAt: new Date("2026-12-01T00:00:00Z"), now: new Date("2026-11-16T00:00:00Z"),
        });
        expect(charge).toBe(180.5);
    });

    it("charges the whole new price without a renewal date", () => {
        expect(estimateUpgradeCharge({ currentAmount: 19, newAmount: 49, interval: "monthly", renewsAt: null })).toBe(49);
    });

    it("never goes below zero", () => {
        const charge = estimateUpgradeCharge({
            currentAmount: 490, newAmount: 49, interval: "yearly",
            renewsAt: new Date("2027-11-01T00:00:00Z"), now: new Date("2026-11-02T00:00:00Z"),
        });
        expect(charge).toBe(0);
    });
});

describe("refundEligible", () => {
    const now = new Date("2026-10-24T12:00:00Z");
    const paid = (daysAgo: number, total = 19000) => ({ total, createdAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000) });
    const yearly = { status: "active" as const, interval: "yearly" as const, refundedAt: null };

    it("refunds a yearly payment within the guarantee", () => {
        expect(refundEligible(yearly, paid(3), now)).toBe(true);
        expect(refundEligible({ ...yearly, status: "cancelled" }, paid(13.9), now)).toBe(true);
    });

    it("doesn't refund after the guarantee", () => {
        expect(refundEligible(yearly, paid(14), now)).toBe(false);
        expect(refundEligible(yearly, paid(40), now)).toBe(false);
    });

    it("doesn't refund monthly payments, free invoices or twice", () => {
        expect(refundEligible({ ...yearly, interval: "monthly" }, paid(1), now)).toBe(false);
        expect(refundEligible(yearly, paid(1, 0), now)).toBe(false);
        expect(refundEligible({ ...yearly, refundedAt: new Date() }, paid(1), now)).toBe(false);
        expect(refundEligible(yearly, null, now)).toBe(false);
    });

    it("doesn't refund an unpaid subscription", () => {
        expect(refundEligible({ ...yearly, status: "past_due" }, paid(1), now)).toBe(false);
    });
});

describe("scheduled changes", () => {
    const businessId = new ObjectId();
    const proId = new ObjectId();
    const change = (at: string, applied = false): ScheduledChange => ({
        from: { planId: businessId, interval: "yearly", variantId: "11" },
        to: { planId: proId, interval: "monthly", variantId: "22" },
        at: new Date(at),
        applied,
    });
    const now = new Date("2026-10-24T12:00:00Z");

    it("keeps what was paid for until the change", () => {
        const subscription = { planId: proId, interval: "monthly" as const, scheduledChange: change("2026-11-01T00:00:00Z", true) };
        expect(subscriptionTerms(subscription, now)).toEqual({ planId: businessId, interval: "yearly" });
        expect(subscriptionTerms(subscription, new Date("2026-11-02T00:00:00Z"))).toEqual({ planId: proId, interval: "monthly" });
    });

    it("reads a subscription without interval as monthly", () => {
        expect(subscriptionTerms({ planId: proId }, now)).toEqual({ planId: proId, interval: "monthly" });
    });

    it("is pending only before its date", () => {
        expect(pendingChange(change("2026-11-01T00:00:00Z"), now)).not.toBeNull();
        expect(pendingChange(change("2026-10-01T00:00:00Z"), now)).toBeNull();
    });

    it("is applied by the job shortly before the end of the period, and dropped after it", () => {
        expect(scheduledChangeAction(change("2026-11-10T00:00:00Z"), now)).toBe("wait");
        expect(scheduledChangeAction(change("2026-10-25T12:00:00Z"), now)).toBe("apply");
        expect(scheduledChangeAction(change("2026-10-24T00:00:00Z"), now)).toBe("drop");
        expect(scheduledChangeAction(change("2026-10-25T00:00:00Z", true), now)).toBe("wait");
    });
});
