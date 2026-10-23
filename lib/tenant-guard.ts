import type { Session } from "next-auth";
import { ObjectId } from "mongodb";
import { ROLES } from "./constants";

/**
 * Multi-tenancy filters: each returns a MongoDB filter that limits a query to the
 * organization the user is working in.
 * - Superadmin: the organization picked in the switcher, or everything when none is picked ('all').
 * - Everyone else: their active organization.
 * - No valid session: a filter that matches nothing.
 */

const MATCH_NOTHING = { _id: new ObjectId("000000000000000000000000") };

/** The organization id to filter by, or null when a superadmin is viewing all organizations. */
function scopedOrgId(session: Session | null): ObjectId | null | undefined {
    const clientId = session?.user?.clientId;
    const hasSelection = !!clientId && clientId !== 'all' && clientId !== 'sup';

    if (session?.user?.role === ROLES.SUPERADMIN) {
        return hasSelection ? new ObjectId(clientId) : null;
    }
    return clientId ? new ObjectId(clientId) : undefined;
}

/** Filter for collections that store a `clientId` field (departments, stock_movements, ...). */
export const getTenantQuery = (session: Session | null) => {
    const orgId = scopedOrgId(session);
    if (orgId === undefined) return MATCH_NOTHING;
    return orgId ? { clientId: orgId } : {};
};

/** Filter for the "users" collection, matching users that belong to the organization. */
export const getUserTenantQuery = (session: Session | null) => {
    const orgId = scopedOrgId(session);
    if (orgId === undefined) return MATCH_NOTHING;
    return orgId ? { "organizations.clientId": orgId } : {};
};

/** Filter for the "clients" (organizations) collection itself. */
export const getClientTenantQuery = (session: Session | null) => {
    const orgId = scopedOrgId(session);
    if (orgId === undefined) return MATCH_NOTHING;
    return orgId ? { _id: orgId } : {};
};
