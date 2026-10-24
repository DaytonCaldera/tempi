import { useEffect, useMemo, useState } from "react";
import { useTimeZone } from "next-intl";
import { zonedRange, zonedToday } from "@/lib/timezone";
import type { ConsumptionReportDepartment, StockMovement } from "@/types/models";

/** Same as HISTORY_LIMITED_HEADER in lib/consumption.ts (server only, so it can't be imported here) */
const HISTORY_LIMITED_HEADER = "X-History-Limited-From";

/** Wall-clock times as datetime-local inputs hold them ("2026-10-24T00:00"), in the user's time zone */
export type DateRange = { start: string; end: string };
export type MovementLog = StockMovement<string>;

/** The instants the range covers, for the server (which stores and compares UTC). */
const rangeQuery = (bounds: { start: Date; end: Date }) =>
    `start=${bounds.start.toISOString()}&end=${bounds.end.toISOString()}`;

/**
 * Loads the consumption report for a date range (and optionally one department),
 * plus the movement log of the product row the user expands.
 * The range is picked in the user's time zone (i18n/request.ts), not the device's: the two differ when the
 * account sets one, and the report must match the times shown everywhere else.
 */
export function useConsumptionReport(deptId?: string) {
    // Always set: i18n/request.ts resolves one for every request
    const timeZone = useTimeZone() ?? "UTC";
    const [range, setRange] = useState<DateRange>(() => zonedToday(timeZone));
    const bounds = useMemo(
        () => (range.start && range.end ? zonedRange(range.start, range.end, timeZone) : null),
        [range.start, range.end, timeZone]
    );
    const [data, setData] = useState<ConsumptionReportDepartment[]>([]);
    const [loading, setLoading] = useState(true);
    // Set when the plan's history cut the start of the range (see lib/consumption.ts historyHeaders)
    const [limitedFrom, setLimitedFrom] = useState<Date | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [loadedDetails, setLoadedDetails] = useState<{ query: string | null; logs: MovementLog[] }>({ query: null, logs: [] });

    useEffect(() => {
        if (!bounds) return;

        const loadReport = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/reports/consumption?${rangeQuery(bounds)}${deptId ? `&deptId=${deptId}` : ""}`);
                const limited = res.headers.get(HISTORY_LIMITED_HEADER);
                setLimitedFrom(limited ? new Date(limited) : null);
                setData(await res.json());
            } catch (error) {
                console.error("Error fetching report:", error);
            } finally {
                setLoading(false);
            }
        };
        loadReport();
    }, [bounds, deptId]);

    // Movements of the expanded row, reloaded when the range changes. Each result is stored with the
    // request it answers, so a slow response never shows under another row or range.
    const detailsQuery = expandedId && bounds
        ? `inventoryId=${expandedId}&${rangeQuery(bounds)}`
        : null;
    const details = loadedDetails.query === detailsQuery ? loadedDetails.logs : [];

    useEffect(() => {
        if (!detailsQuery) return;

        const controller = new AbortController();
        const loadDetails = async () => {
            try {
                const res = await fetch(`/api/admin/reports/consumption/details?${detailsQuery}`, { signal: controller.signal });
                const logs: MovementLog[] = res.ok ? await res.json() : [];
                setLoadedDetails({ query: detailsQuery, logs });
            } catch (error) {
                if (!controller.signal.aborted) console.error("Error fetching movements:", error);
            }
        };
        loadDetails();
        return () => controller.abort();
    }, [detailsQuery]);

    /** Expands a product row (its movements load in the effect above), or collapses it if already open. */
    const toggleDetails = (inventoryId: string) => {
        setExpandedId(current => (current === inventoryId ? null : inventoryId));
    };

    const exportUrl = bounds
        ? `/api/admin/reports/export?${rangeQuery(bounds)}${deptId ? `&deptId=${deptId}` : ""}`
        : null;

    return { range, setRange, bounds, data, loading, limitedFrom, exportUrl, expandedId, details, toggleDetails };
}
