import type { Session } from "next-auth";
import type { ObjectId } from "mongodb";
import { getDb } from "@/lib/api";
import { getTenantQuery } from "@/lib/tenant-guard";
import type { Department } from "@/types/models";

/**
 * Finds a department only if it belongs to the user's organization (multi-tenancy check).
 * Returns null when it doesn't exist or belongs to another organization.
 */
export async function findOwnDepartment(session: Session, departmentId: ObjectId) {
    const db = await getDb();
    return db.collection<Department>('departments').findOne({ _id: departmentId, ...getTenantQuery(session) });
}
