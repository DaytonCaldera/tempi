import type { Session } from "next-auth";
import { PERMISSIONS } from "@/lib/constants";
import { getLowStock } from "@/lib/dashboard";
import { listHeld } from "@/lib/offline-sync-server";
import { hasPermission } from "@/lib/permissions";

/**
 * Server only: what the navbar's bell shows, worked out on each request (nothing is stored, so nothing is read
 * or unread): the low stock of the dashboard and the held moves waiting for the user. The runner's own offline
 * queue lives in the browser and is added by the bell itself (components/dashboard/NotificationsMenu.tsx).
 */

/** Low stock products listed in the bell; the rest are a count */
const LOW_STOCK_SHOWN = 5;

export type NotificationsData = {
    lowStock: { total: number; items: { _id: string; productName: string; departmentName: string; quantity: number; minStock: number; unit: string; href: string }[] };
    /** Held moves the user can decide (the dashboard's held card) */
    held: number;
};

export async function getNotifications(session: Session): Promise<NotificationsData> {
    if (!session.user.clientId) return { lowStock: { total: 0, items: [] }, held: 0 };
    const [lowStock, held] = await Promise.all([getLowStock(session, LOW_STOCK_SHOWN), listHeld(session)]);
    // Where the dashboard's low stock card links too
    const canEditStock = hasPermission(session, PERMISSIONS.EDIT_STOCK);
    return {
        lowStock: {
            total: lowStock.total,
            items: lowStock.items.map(item => ({
                _id: item._id,
                productName: item.productName,
                departmentName: item.departmentName,
                quantity: item.quantity,
                minStock: item.minStock,
                unit: item.unit,
                href: canEditStock ? `/admin/departments/${item.departmentId}/stock` : "/runner",
            })),
        },
        held: held.length,
    };
}
