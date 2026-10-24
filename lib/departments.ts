import type { Session } from "next-auth";
import type { ObjectId } from "mongodb";
import { getDb, toObjectId } from "@/lib/api";
import { getTenantQuery } from "@/lib/tenant-guard";
import type { Department, StockItem } from "@/types/models";

/**
 * Finds a department only if it belongs to the user's organization (multi-tenancy check).
 * Returns null when it doesn't exist or belongs to another organization.
 */
export async function findOwnDepartment(session: Session, departmentId: ObjectId) {
    const db = await getDb();
    return db.collection<Department>('departments').findOne({ _id: departmentId, ...getTenantQuery(session) });
}

/**
 * Departments the user is assigned to in their active organization.
 * Read from the session, which is resolved from the user's document (see the jwt callback in auth.ts).
 */
export function assignedDepartmentIds(session: Session): ObjectId[] {
    const membership = session.user.organizations?.find(m => m.clientId === session.user.clientId);
    return (membership?.departments || []).map(toObjectId).filter((id): id is ObjectId => id !== null);
}

/**
 * Stock of the departments the user is assigned to, sorted by product name, with ids as strings for the client.
 * Shared by the runner page (first render) and GET /api/admin/inventory (its polling), so both return the same shape.
 */
export async function assignedStock(session: Session): Promise<StockItem<string>[]> {
    const assignedIds = assignedDepartmentIds(session);
    if (assignedIds.length === 0) return [];

    const db = await getDb();
    // Only departments that really belong to the organization: a membership pointing at another
    // organization's department (bad data, or an older toggle-status bug) must not expose its stock
    const departmentIds = await db.collection<Department>('departments')
        .find({ _id: { $in: assignedIds }, ...getTenantQuery(session) }, { projection: { _id: 1 } })
        .map(d => d._id)
        .toArray();
    if (departmentIds.length === 0) return [];

    const items = await db.collection<StockItem>('department_stock')
        .find({ departmentId: { $in: departmentIds }, isDeleted: { $ne: true } })
        .sort({ productName: 1 })
        .toArray();

    return items.map(item => ({
        ...item,
        _id: item._id.toString(),
        departmentId: item.departmentId.toString(),
        clientId: item.clientId?.toString(),
    }));
}
