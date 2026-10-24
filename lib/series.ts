import type { Collection, Document } from "mongodb";
import { timeZone as defaultTimeZone } from "@/i18n/config";

/**
 * Server only: counts over time for the charts (components/ui/stats.tsx BarChart), by hour or day on the clocks of
 * a time zone: the viewer's for the organization dashboard (lib/dashboard.ts), the default one for the superadmin
 * overview (lib/superadmin.ts).
 */

/** A number and, when there is one to compare with, its value in the previous period. */
export type Metric = { value: number; previous?: number };
export type SeriesPoint = { bucket: string; value: number };

const DAY_MS = 24 * 60 * 60_000;

const BUCKET_FORMAT = { hour: "%Y-%m-%dT%H:00", day: "%Y-%m-%d" };

/** Documents per hour or day, keyed like fillBuckets() keys them. */
export async function bucketCounts(collection: Collection<Document>, date: unknown, match: Document, unit: "hour" | "day", timeZone = defaultTimeZone) {
    const rows = await collection.aggregate([
        { $match: match },
        { $group: { _id: { $dateToString: { date: { $dateTrunc: { date, unit, timezone: timeZone } }, format: BUCKET_FORMAT[unit], timezone: timeZone } }, value: { $sum: 1 } } },
    ]).toArray();
    return new Map(rows.map(row => [row._id as string, row.value as number]));
}

/** Every bucket of the range in order, with 0 where nothing happened, so the chart has no gaps. */
export function fillBuckets(counts: Map<string, number>, start: Date, end: Date, unit: "hour" | "day", timeZone = defaultTimeZone): SeriesPoint[] {
    const step = unit === "hour" ? 60 * 60_000 : DAY_MS;
    const keyOf = (date: Date) => {
        const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
            timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
        }).formatToParts(date).map(p => [p.type, p.value]));
        return unit === "hour" ? `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:00` : `${parts.year}-${parts.month}-${parts.day}`;
    };

    // The first and last buckets are partial: the range starts and ends at the current time of day
    const buckets = new Set<string>();
    for (let time = start.getTime(); time < end.getTime(); time += step) buckets.add(keyOf(new Date(time)));
    buckets.add(keyOf(end));
    return [...buckets].map(bucket => ({ bucket, value: counts.get(bucket) ?? 0 }));
}
