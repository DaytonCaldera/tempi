import { useEffect, useState } from "react";
import type { ConsumptionReportDepartment, StockMovement } from "@/types/models";

/** Same as HISTORY_LIMITED_HEADER in lib/consumption.ts (server only, so it can't be imported here) */
const HISTORY_LIMITED_HEADER = "X-History-Limited-From";

export type DateRange = { start: string; end: string };
export type MovementLog = StockMovement<string>;

/** Formats a date for a <input type="datetime-local"> in the browser's timezone. */
const toLocalInputValue = (date: Date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

/** Today from 00:00 to 23:59. */
const todayRange = (): DateRange => ({
    start: toLocalInputValue(new Date(new Date().setHours(0, 0, 0, 0))),
    end: toLocalInputValue(new Date(new Date().setHours(23, 59, 59, 999)))
});

const rangeQuery = (range: DateRange) =>
    `start=${new Date(range.start).toISOString()}&end=${new Date(range.end).toISOString()}`;

/**
 * Loads the consumption report for a date range (and optionally one department),
 * plus the movement log of the product row the user expands.
 */
export function useConsumptionReport(deptId?: string) {
    const [range, setRange] = useState<DateRange>(todayRange);
    const [data, setData] = useState<ConsumptionReportDepartment[]>([]);
    const [loading, setLoading] = useState(true);
    // Set when the plan's history cut the start of the range (see lib/consumption.ts historyHeaders)
    const [limitedFrom, setLimitedFrom] = useState<Date | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [loadedDetails, setLoadedDetails] = useState<{ query: string | null; logs: MovementLog[] }>({ query: null, logs: [] });

    useEffect(() => {
        if (!range.start || !range.end) return;

        const loadReport = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/reports/consumption?${rangeQuery(range)}${deptId ? `&deptId=${deptId}` : ""}`);
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
    }, [range, deptId]);

    // Movements of the expanded row, reloaded when the range changes. Each result is stored with the
    // request it answers, so a slow response never shows under another row or range.
    const detailsQuery = expandedId && range.start && range.end
        ? `inventoryId=${expandedId}&${rangeQuery(range)}`
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

    const exportUrl = range.start && range.end
        ? `/api/admin/reports/export?${rangeQuery(range)}${deptId ? `&deptId=${deptId}` : ""}`
        : null;

    return { range, setRange, data, loading, limitedFrom, exportUrl, expandedId, details, toggleDetails };
}
