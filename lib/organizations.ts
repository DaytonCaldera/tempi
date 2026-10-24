import { randomInt } from "crypto";
import type { Session } from "next-auth";
import { getDb, toObjectId } from "@/lib/api";
import { isPlaceholderOrg, ROLES } from "@/lib/constants";
import { forgetCachedUsers } from "@/lib/users";
import type { Membership, Organization, User } from "@/types/models";

/**
 * The user's active memberships in organizations other than `clientId`. Works with memberships from the DB
 * and from the session. Closed organizations never show up: closing one removes every membership in it.
 */
export function otherActiveMemberships<M extends Membership<string> | Membership>(memberships: M[] | undefined, clientId: string): M[] {
    return (memberships || []).filter(m => !isPlaceholderOrg(m) && m.status === "active" && m.clientId.toString() !== clientId);
}

/** Letters and digits for join codes, without the ones that are easy to confuse (0/O, 1/I/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * New, unused join code in the format "ABCD-2345": 31^8 combinations from a cryptographic random source,
 * so it can't be guessed (POST /api/user/join also limits wrong attempts).
 */
export async function generateClientCode(): Promise<string> {
    const db = await getDb();
    for (;;) {
        const chars = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
        const code = `${chars.slice(0, 4)}-${chars.slice(4)}`;
        if (!await db.collection('clients').findOne({ clientCode: code }, { projection: { _id: 1 } })) return code;
    }
}

/**
 * The stored forms a typed join code can have: "ABCD-2345", or "ABC-123" for organizations created before
 * the longer codes. The dash and the case don't matter.
 */
export function joinCodeCandidates(code: unknown): string[] {
    if (typeof code !== "string") return [];
    const chars = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (chars.length === 8) return [`${chars.slice(0, 4)}-${chars.slice(4)}`];
    if (chars.length === 6) return [`${chars.slice(0, 3)}-${chars.slice(3)}`];
    return [];
}

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
 * Whether the session's user may close the organization: its owner.
 * Organizations created before ownerEmail was stored can be closed by any of their admins.
 */
export function canCloseOrganization(session: Session, organization: Pick<Organization, "ownerEmail">): boolean {
    if (!organization.ownerEmail) return session.user.role === ROLES.ADMIN;
    return isOrganizationOwner(session.user.email, organization);
}

/** Whether that email is the organization's owner. Organizations created before ownerEmail was stored have none. */
export function isOrganizationOwner(email: string | null | undefined, organization: Pick<Organization, "ownerEmail">): boolean {
    return !!email && !!organization.ownerEmail && organization.ownerEmail.toLowerCase() === email.toLowerCase();
}

/** Open organizations owned by that email, with their names. */
export async function ownedOpenOrganizations(email: string) {
    const db = await getDb();
    // ownerEmail is stored as Google returned it: match it case-insensitively
    const ownerEmail = { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" };
    return db.collection<Organization>('clients')
        .find({ ownerEmail, ...OPEN_ORGANIZATION } as object, { projection: { name: 1 } })
        .toArray();
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
