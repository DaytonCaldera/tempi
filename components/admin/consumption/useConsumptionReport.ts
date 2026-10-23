import { useEffect, useState } from "react";
import type { ConsumptionReportDepartment, StockMovement } from "@/types/models";

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
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [details, setDetails] = useState<MovementLog[]>([]);

    useEffect(() => {
        if (!range.start || !range.end) return;

        const loadReport = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/reports/consumption?${rangeQuery(range)}${deptId ? `&deptId=${deptId}` : ""}`);
                setData(await res.json());
            } catch (error) {
                console.error("Error fetching report:", error);
            } finally {
                setLoading(false);
            }
        };
        loadReport();
    }, [range, deptId]);

    /** Expands a product row and loads its movements, or collapses it if already open. */
    const toggleDetails = async (inventoryId: string) => {
        if (expandedId === inventoryId) {
            setExpandedId(null);
            return;
        }
        setExpandedId(inventoryId);
        const res = await fetch(`/api/admin/reports/consumption/details?inventoryId=${inventoryId}&${rangeQuery(range)}`);
        setDetails(res.ok ? await res.json() : []);
    };

    return { range, setRange, data, loading, expandedId, details, toggleDetails };
}
