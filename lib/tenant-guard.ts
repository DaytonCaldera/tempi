import type { Session } from "next-auth";
import { ObjectId } from "mongodb";
import { ROLES } from "./constants";

/**
 * Multi-tenancy filters: each returns a MongoDB filter that limits a query to the
 * organization the user is working in.
 * - Users: their active organization.
 * - Superadmin, or no valid session: a filter that matches nothing. The superadmin reads across organizations
 *   only from the /superadmin panel (lib/superadmin.ts), never through these filters.
 */

const MATCH_NOTHING = { _id: new ObjectId("000000000000000000000000") };

/** The organization id to filter by, or undefined when the session has none (the superadmin never has one). */
function scopedOrgId(session: Session | null): ObjectId | undefined {
    if (session?.user?.role === ROLES.SUPERADMIN) return undefined;
    const clientId = session?.user?.clientId;
    return clientId && ObjectId.isValid(clientId) ? new ObjectId(clientId) : undefined;
}

/** Filter for collections that store a `clientId` field (departments, stock_movements, ...). */
export const getTenantQuery = (session: Session | null) => {
    const orgId = scopedOrgId(session);
    return orgId ? { clientId: orgId } : MATCH_NOTHING;
};

/** Filter for the "users" collection, matching users that belong to the organization. */
export const getUserTenantQuery = (session: Session | null) => {
    const orgId = scopedOrgId(session);
    return orgId ? { "organizations.clientId": orgId } : MATCH_NOTHING;
};

/** Filter for the "clients" (organizations) collection itself. */
export const getClientTenantQuery = (session: Session | null) => {
    const orgId = scopedOrgId(session);
    return orgId ? { _id: orgId } : MATCH_NOTHING;
};
