import { describe, expect, it } from "vitest";
import { costSnapshot, currencyOf, isCurrency, normalizeCost } from "@/lib/currency";

describe("normalizeCost", () => {
    it("is null when empty", () => {
        expect(normalizeCost(undefined)).toBe(null);
        expect(normalizeCost(null)).toBe(null);
        expect(normalizeCost("")).toBe(null);
    });

    it("reads numbers and amounts as people type them", () => {
        expect(normalizeCost(1500)).toBe(1500);
        expect(normalizeCost("1500")).toBe(1500);
        expect(normalizeCost("1,5")).toBe(1.5);
        expect(normalizeCost("1.5")).toBe(1.5);
        expect(normalizeCost("₡3.500,50")).toBe(3500.5);
        expect(normalizeCost("$1,500.25")).toBe(1500.25);
        expect(normalizeCost(" 12 ")).toBe(12);
        expect(normalizeCost("1.500")).toBe(1500);
        expect(normalizeCost("1,500")).toBe(1500);
        expect(normalizeCost("1.500.000")).toBe(1500000);
        expect(normalizeCost("0.125")).toBe(0.125);
        expect(normalizeCost("12.75")).toBe(12.75);
        expect(normalizeCost(0)).toBe(0);
    });

    it("rounds to 4 decimals", () => {
        expect(normalizeCost("0.123456")).toBe(0.1235);
    });

    it("rejects what can't be a cost", () => {
        expect(normalizeCost("-5")).toBe(false);
        expect(normalizeCost(-1)).toBe(false);
        expect(normalizeCost("abc")).toBe(false);
        expect(normalizeCost(Number.NaN)).toBe(false);
        expect(normalizeCost(2_000_000_000)).toBe(false);
    });
});

describe("currencies", () => {
    it("falls back to USD", () => {
        expect(currencyOf({ currency: "CRC" })).toBe("CRC");
        expect(currencyOf({ currency: "XYZ" })).toBe("USD");
        expect(currencyOf(null)).toBe("USD");
        expect(isCurrency("EUR")).toBe(true);
        expect(isCurrency("eur")).toBe(false);
    });

    it("snapshots a cost only when there is one", () => {
        expect(costSnapshot(1200)).toEqual({ unitCost: 1200 });
        expect(costSnapshot(0)).toEqual({ unitCost: 0 });
        expect(costSnapshot(undefined)).toEqual({});
        expect(costSnapshot(null)).toEqual({});
    });
});
