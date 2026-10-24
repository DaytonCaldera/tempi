import { describe, expect, it } from "vitest";
import { isTimeZone, toZonedInput, zonedRange, zonedToday, zonedToUtc } from "@/lib/timezone";

describe("isTimeZone", () => {
    it("accepts IANA zones and rejects anything else", () => {
        expect(isTimeZone("America/Costa_Rica")).toBe(true);
        expect(isTimeZone("UTC")).toBe(true);
        expect(isTimeZone("Mars/Olympus")).toBe(false);
        expect(isTimeZone("")).toBe(false);
        expect(isTimeZone(null)).toBe(false);
        expect(isTimeZone(42)).toBe(false);
    });
});

describe("zonedToUtc", () => {
    it("reads a wall-clock time in the given zone", () => {
        // Costa Rica is UTC-6 all year
        expect(zonedToUtc("2026-10-24T00:00", "America/Costa_Rica").toISOString()).toBe("2026-10-24T06:00:00.000Z");
        expect(zonedToUtc("2026-10-24T13:30", "Asia/Tokyo").toISOString()).toBe("2026-10-24T04:30:00.000Z");
        expect(zonedToUtc("2026-10-24T13:30", "UTC").toISOString()).toBe("2026-10-24T13:30:00.000Z");
    });

    it("crosses the date line correctly", () => {
        // Midnight in Tokyo is still the previous day in UTC
        expect(zonedToUtc("2026-10-25T00:00", "Asia/Tokyo").toISOString()).toBe("2026-10-24T15:00:00.000Z");
    });

    it("handles daylight saving changes", () => {
        // Madrid: CEST (UTC+2) until 2026-10-25 03:00, then CET (UTC+1)
        expect(zonedToUtc("2026-10-24T12:00", "Europe/Madrid").toISOString()).toBe("2026-10-24T10:00:00.000Z");
        expect(zonedToUtc("2026-10-26T12:00", "Europe/Madrid").toISOString()).toBe("2026-10-26T11:00:00.000Z");
        // New York springs forward on 2026-03-08: 02:30 doesn't exist and lands an hour later
        expect(zonedToUtc("2026-03-08T02:30", "America/New_York").toISOString()).toBe("2026-03-08T07:30:00.000Z");
    });

    it("is the inverse of toZonedInput", () => {
        const date = new Date("2026-10-24T18:48:00.000Z");
        for (const zone of ["America/Costa_Rica", "Asia/Tokyo", "Europe/Madrid", "Pacific/Chatham", "Asia/Kolkata"]) {
            expect(zonedToUtc(toZonedInput(date, zone), zone).toISOString()).toBe(date.toISOString());
        }
    });
});

describe("toZonedInput", () => {
    it("formats an instant on the zone's clocks", () => {
        const date = new Date("2026-10-24T18:48:00.000Z");
        expect(toZonedInput(date, "America/Costa_Rica")).toBe("2026-10-24T12:48");
        expect(toZonedInput(date, "Asia/Tokyo")).toBe("2026-10-25T03:48");
    });
});

describe("zonedToday", () => {
    it("is today on the zone's clocks, which can be another date than UTC's", () => {
        const now = new Date("2026-10-24T19:27:00.000Z"); // 13:27 in Costa Rica, 04:27 next day in Tokyo
        expect(zonedToday("America/Costa_Rica", now)).toEqual({ start: "2026-10-24T00:00", end: "2026-10-24T23:59" });
        expect(zonedToday("Asia/Tokyo", now)).toEqual({ start: "2026-10-25T00:00", end: "2026-10-25T23:59" });
    });
});

describe("zonedRange", () => {
    it("includes the whole last minute", () => {
        const { start, end } = zonedRange("2026-10-24T00:00", "2026-10-24T23:59", "America/Costa_Rica");
        expect(start.toISOString()).toBe("2026-10-24T06:00:00.000Z");
        expect(end.toISOString()).toBe("2026-10-25T05:59:59.999Z");
    });
});
