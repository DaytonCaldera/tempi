import type { Session } from "next-auth";
import type { ObjectId } from "mongodb";
import { getDb, toObjectId } from "@/lib/api";
import { PLAN_FEATURES } from "@/lib/constants";
import { hasPlanFeature } from "@/lib/plans";
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
 * Departments the user works in as a runner: the ones they are assigned to when the organization's plan has
 * department assignment, or every department of the organization when it doesn't (lib/plans.ts).
 * Users without any assignment (not approved into an area) still get none.
 */
export async function runnerDepartmentIds(session: Session): Promise<ObjectId[]> {
    const assignedIds = assignedDepartmentIds(session);
    const clientId = toObjectId(session.user.clientId);
    if (assignedIds.length === 0 || !clientId || await hasPlanFeature(clientId, PLAN_FEATURES.DEPARTMENT_ASSIGNMENT)) return assignedIds;

    const db = await getDb();
    return db.collection<Department>('departments').find({ clientId }, { projection: { _id: 1 } }).map(d => d._id).toArray();
}

/**
 * Stock of the departments the user works in (runnerDepartmentIds), sorted by product name, with ids as strings
 * for the client. Shared by the runner page (first render) and GET /api/admin/inventory (its polling), so both
 * return the same shape.
 */
export async function assignedStock(session: Session, runnerIds?: ObjectId[]): Promise<StockItem<string>[]> {
    const assignedIds = runnerIds ?? await runnerDepartmentIds(session);
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
        // Costs stay with the people who manage stock and reports: the runner view doesn't show them
        unitCost: undefined,
        _id: item._id.toString(),
        departmentId: item.departmentId.toString(),
        clientId: item.clientId?.toString(),
    }));
}
