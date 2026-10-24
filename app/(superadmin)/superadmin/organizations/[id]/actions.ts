"use server";
import { revalidatePath } from "next/cache";
import { getDb, toObjectId } from "@/lib/api";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { ROLES, SUPPORT_REASON_MIN_LENGTH } from "@/lib/constants";
import { generateClientCode, OPEN_ORGANIZATION } from "@/lib/organizations";
import { requireSuperadmin } from "@/lib/superadmin";
import { forgetCachedUsers } from "@/lib/users";
import type { Organization, User } from "@/types/models";

/**
 * Superadmin support tools for one organization. Server actions are plain POST endpoints, so each one checks
 * the role itself (requireSuperadmin), validates everything it receives, and records itself in the audit log
 * with the reason the superadmin typed.
 */

/** `error` is a key of the "superadmin.tools.errors" messages (or "reasonTooShort" of "superadmin.tools"). */
export type ToolState = { ok?: boolean; error?: "notFound" | "closed" | "confirmMismatch" | "invalid" | "pickMember" | "reasonTooShort"; code?: string; name?: string };

const readReason = (form: FormData) => {
    const reason = String(form.get("reason") ?? "").trim();
    return reason.length >= SUPPORT_REASON_MIN_LENGTH ? reason.slice(0, 500) : null;
};

/**
 * Runs a tool and turns an unexpected failure into a message instead of a silent click.
 * requireSuperadmin() stays outside: its redirect is thrown, and must not be caught.
 */
async function guarded(name: string, run: () => Promise<ToolState>): Promise<ToolState> {
    try {
        return await run();
    } catch (error) {
        console.error(`Superadmin tool ${name} failed:`, error);
        return { error: "invalid" };
    }
}

/** Replaces the organization's join code (e.g. it leaked). Members keep their access; the old code stops working. */
export async function regenerateJoinCode(_: ToolState, form: FormData): Promise<ToolState> {
    const session = await requireSuperadmin();
    return guarded("regenerateJoinCode", async () => {
        const _id = toObjectId(form.get("clientId"));
        if (!_id) return { error: "invalid" };
        const reason = readReason(form);
        if (!reason) return { error: "reasonTooShort" };

        const db = await getDb();
        const organization = await db.collection<Organization>("clients").findOne({ _id }, { projection: { name: 1, status: 1 } });
        if (!organization) return { error: "notFound" };
        if (organization.status === "closed") return { error: "closed" };

        const code = await generateClientCode();
        await db.collection("clients").updateOne({ _id, ...OPEN_ORGANIZATION }, { $set: { clientCode: code } });
        // The creator's membership keeps a copy of the code (shown in their session): refresh only those copies
        await db.collection("users").updateMany(
            { "organizations.clientId": _id },
            { $set: { "organizations.$[m].clientCode": code } },
            { arrayFilters: [{ "m.clientId": _id, "m.clientCode": { $exists: true } }] }
        );
        forgetCachedUsers();

        // The codes themselves aren't logged: the old one is dead and the new one is a secret of the organization
        await logAudit(AUDIT_ACTIONS.REGENERATE_CODE, {
            actor: session.user, clientId: _id, target: { type: "organization", id: _id, label: organization.name }, details: { reason },
    });
    revalidatePath(`/superadmin/organizations/${_id}`);
    return { ok: true, code };
    });
}

/**
 * Makes another active member the owner. They become an active admin; the previous owner stays an admin.
 * The organization's name must be typed to confirm.
 */
export async function transferOwnership(_: ToolState, form: FormData): Promise<ToolState> {
    const session = await requireSuperadmin();
    return guarded("transferOwnership", async () => {
        const _id = toObjectId(form.get("clientId"));
        if (!_id) return { error: "invalid" };
        const userId = toObjectId(form.get("userId"));
        if (!userId) return { error: "pickMember" };
        const reason = readReason(form);
        if (!reason) return { error: "reasonTooShort" };

        const db = await getDb();
        const [organization, user] = await Promise.all([
            db.collection<Organization>("clients").findOne({ _id }, { projection: { name: 1, status: 1, ownerEmail: 1 } }),
            db.collection<User>("users").findOne({ _id: userId }, { projection: { name: 1, email: 1, isActive: 1, organizations: 1 } }),
        ]);
        if (!organization || !user) return { error: "notFound" };
        if (organization.status === "closed") return { error: "closed" };
        if (String(form.get("confirmName") ?? "").trim() !== organization.name.trim()) return { error: "confirmMismatch" };

        // Only someone already working in the organization, never a pending or deactivated member
        const membership = user.organizations?.find(m => m.clientId.toString() === _id.toString());
        if (user.isActive === false || membership?.status !== "active" || membership.role === ROLES.PENDING_USER) return { error: "invalid" };
        if (organization.ownerEmail?.toLowerCase() === user.email.toLowerCase()) return { ok: true, name: user.name };

        await db.collection("clients").updateOne({ _id, ...OPEN_ORGANIZATION }, { $set: { ownerEmail: user.email } });
        await db.collection("users").updateOne(
            { _id: userId, organizations: { $elemMatch: { clientId: { $in: [_id, _id.toString()] } } } } as object,
            { $set: { "organizations.$.role": ROLES.ADMIN, "organizations.$.status": "active" } }
        );
        forgetCachedUsers();

        await logAudit(AUDIT_ACTIONS.TRANSFER_OWNERSHIP, {
            actor: session.user, clientId: _id, target: { type: "user", id: userId, label: user.name },
            details: { reason, owner: { before: organization.ownerEmail ?? null, after: user.email }, previousRole: membership.role },
    });
    revalidatePath(`/superadmin/organizations/${_id}`);
    return { ok: true, name: user.name };
    });
}
