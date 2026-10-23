import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { MovementType, StockItem } from "@/types/models";

export type StockRow = StockItem<string>;

/**
 * A department's inventory, polled every 5 seconds, with optimistic quick moves and deletes.
 */
export function useDepartmentStock(departmentId: string, initialInventory: StockRow[]) {
    const { data: inventory = [], mutate } = useSWR<StockRow[]>(
        `/api/admin/departments/${departmentId}/stock`,
        fetcher,
        { fallbackData: initialInventory, refreshInterval: 5000 }
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
            body: JSON.stringify({ amount, type, reason: "Ajuste rápido Admin" })
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

    return { inventory, quickMove, remove };
}
