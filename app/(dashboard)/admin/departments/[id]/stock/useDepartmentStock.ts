import useSWR from "swr";
import { fetcher, STOCK_REFRESH_INTERVAL } from "@/lib/fetcher";
import { MOVEMENT_REASONS } from "@/lib/constants";
import type { MovementType, StockItem } from "@/types/models";

export type StockRow = StockItem<string>;

/**
 * A department's inventory, polled to show changes made by others, with optimistic quick moves and deletes.
 */
export function useDepartmentStock(departmentId: string, initialInventory: StockRow[]) {
    const { data: inventory = [], mutate } = useSWR<StockRow[]>(
        `/api/admin/departments/${departmentId}/stock`,
        fetcher,
        { fallbackData: initialInventory, refreshInterval: STOCK_REFRESH_INTERVAL }
    );

    /** Adds or removes one unit. */
    const quickMove = async (item: StockRow, type: MovementType) => {
        const amount = 1;
        // Show the change right away, then re-sync with the server
        mutate(inventory.map(i => i._id !== item._id ? i : {
            ...i,
            quantity: type === "IN" ? i.quantity + amount : i.quantity - amount
        }), false);

        await fetch(`/api/admin/inventory/${item._id}/move`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount, type, reason: MOVEMENT_REASONS.ADMIN_QUICK_ADJUSTMENT })
        });
        mutate();
    };

    /** Soft-deletes an item (its movement history is kept). */
    const remove = async (item: StockRow) => {
        mutate(inventory.filter(i => i._id !== item._id), false);
        try {
            await fetch(`/api/admin/departments/${departmentId}/stock/${item._id}`, { method: "DELETE" });
        } finally {
            mutate();
        }
    };

    return { inventory, quickMove, remove, refresh: () => mutate() };
}
