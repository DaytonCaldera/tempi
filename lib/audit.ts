import type { Session } from "next-auth";
import type { ObjectId } from "mongodb";
import { getDb, toObjectId } from "@/lib/api";

/** What happened. Stored as-is in audit_log.action; the superadmin panel labels them with the "audit.actions" messages. */
export const AUDIT_ACTIONS = {
    SIGN_UP: "user.signUp",
    SIGN_IN: "user.signIn",
    DELETE_ACCOUNT: "user.deleteAccount",
    CREATE_ORGANIZATION: "organization.create",
    JOIN_ORGANIZATION: "organization.join",
    LEAVE_ORGANIZATION: "organization.leave",
    CLOSE_ORGANIZATION: "organization.close",
    APPROVE_MEMBER: "member.approve",
    UPDATE_MEMBER: "member.update",
    // Superadmin support tools (app/(superadmin)/superadmin/organizations/[id]/actions.ts). details.reason says why
    REGENERATE_CODE: "organization.regenerateCode",
    TRANSFER_OWNERSHIP: "organization.transferOwnership",
    REPAIR_STOCK: "organization.repairStock",
    CHANGE_PLAN: "organization.changePlan",
    RESTORE_ORGANIZATION: "organization.restore",
    EXPORT_CSV: "superadmin.export",
    // The superadmin opened an organization's read-only view (lib/superadmin-view.ts)
    VIEW_AS: "superadmin.viewAs",
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

/** An entry of the "audit_log" collection. */
export interface AuditEntry<Id = ObjectId> {
    _id: Id;
    action: AuditAction;
    /** Who did it. Stored by value, so the entry still reads right after the user is deleted. */
    actor: { id?: Id | null; email?: string | null; name?: string | null };
    /** The organization it happened in, if any. */
    clientId?: Id | null;
    /** The user or organization it was done to, when it isn't the actor. */
    target?: { type: "user" | "organization"; id?: Id | null; label?: string | null };
    /** Action-specific values, e.g. { before, after } for a membership change. */
    details?: Record<string, unknown>;
    createdAt: Date;
}

type AuditInput = {
    actor: Session["user"] | { id?: ObjectId | string | null; email?: string | null; name?: string | null } | null | undefined;
    clientId?: ObjectId | string | null;
    target?: { type: "user" | "organization"; id?: ObjectId | string | null; label?: string | null };
    details?: Record<string, unknown>;
};

/**
 * Records an action in audit_log. Never throws: a failed write is logged to the console,
 * so it can't break the action it describes (which already happened).
 */
export async function logAudit(action: AuditAction, { actor, clientId, target, details }: AuditInput) {
    try {
        const db = await getDb();
        await db.collection("audit_log").insertOne({
            action,
            actor: { id: toObjectId(actor?.id), email: actor?.email ?? null, name: actor?.name ?? null },
            clientId: toObjectId(clientId),
            ...(target && { target: { type: target.type, id: toObjectId(target.id), label: target.label ?? null } }),
            ...(details && { details }),
            createdAt: new Date(),
        });
    } catch (error) {
        console.error(`Audit log write failed (${action}):`, error);
    }
}
