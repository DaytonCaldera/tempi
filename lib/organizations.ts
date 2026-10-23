import type { Session } from "next-auth";
import { getDb, toObjectId } from "@/lib/api";
import { ROLES } from "@/lib/constants";
import { forgetCachedUsers } from "@/lib/users";
import type { Organization, User } from "@/types/models";

/** Filter for organizations that haven't been closed (older documents have no status). */
export const OPEN_ORGANIZATION = { status: { $ne: "closed" } } as const;

/** Name of an organization ("clients" collection), or "" if it doesn't exist. */
export async function getOrganizationName(clientId: string): Promise<string> {
    const _id = toObjectId(clientId);
    if (!_id) return "";

    const db = await getDb();
    const organization = await db.collection('clients').findOne({ _id }, { projection: { name: 1 } });
    return organization?.name || "";
}

/**
 * Whether the session's user may close the organization: its owner or the superadmin.
 * Organizations created before ownerEmail was stored can be closed by any of their admins.
 */
export function canCloseOrganization(session: Session, organization: Pick<Organization, "ownerEmail">): boolean {
    if (session.user.role === ROLES.SUPERADMIN) return true;
    if (!organization.ownerEmail) return session.user.role === ROLES.ADMIN;
    return organization.ownerEmail.toLowerCase() === session.user.email?.toLowerCase();
}

/**
 * Closes an organization: it is marked as closed and every user loses their membership, so it no longer
 * appears in their switcher and its join code stops working. Users left without an organization go back
 * to the lobby. Departments, stock and movements are kept, so a closed organization can be restored from the DB.
 */
export async function closeOrganization(clientId: string, closedBy: string): Promise<boolean> {
    const _id = toObjectId(clientId);
    if (!_id) return false;

    const db = await getDb();
    const result = await db.collection('clients').updateOne(
        { _id, ...OPEN_ORGANIZATION },
        { $set: { status: "closed", closedAt: new Date(), closedBy } }
    );
    if (result.matchedCount === 0) return false;

    const users = db.collection<User>('users');
    // Memberships migrated from the old top-level clientId may store it as a string
    const anyIdForm = { $in: [_id, _id.toString()] };
    // Sign-in falls back to the user's first active membership when activeOrganization is null
    await users.updateMany({ activeOrganization: anyIdForm } as object, { $set: { activeOrganization: null } });
    await users.updateMany(
        { "organizations.clientId": anyIdForm } as object,
        { $pull: { organizations: { clientId: anyIdForm } } } as object
    );
    forgetCachedUsers();
    return true;
}
