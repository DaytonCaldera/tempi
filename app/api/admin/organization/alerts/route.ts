import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { badRequest, getDb, notFound, serverError, toObjectId } from "@/lib/api";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/constants";
import { OPEN_ORGANIZATION } from "@/lib/organizations";
import { alertSettingsOf, MAX_EXTRA_EMAILS, type AlertSettings } from "@/lib/stock-alerts";
import type { Organization } from "@/types/models";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * PATCH /api/admin/organization/alerts
 * Changes which emails the active organization gets (lib/stock-alerts.ts). Admins only.
 * Body: { lowStockEmail: boolean, extraEmails: string[] } (up to MAX_EXTRA_EMAILS addresses besides the admins)
 * Returns the saved settings.
 */
export async function PATCH(req: Request) {
    const { session, error } = await requirePermission(PERMISSIONS.MANAGE_USERS);
    if (error) return error;

    try {
        const clientId = toObjectId(session.user.clientId);
        if (!clientId) return badRequest("missingOrganizationId");

        const body = await req.json().catch(() => null);
        if (typeof body?.lowStockEmail !== "boolean" || !Array.isArray(body.extraEmails)) return badRequest();
        const extraEmails = [...new Set(body.extraEmails
            .filter((e: unknown): e is string => typeof e === "string")
            .map((e: string) => e.trim().toLowerCase())
            .filter(Boolean))] as string[];
        if (extraEmails.length > MAX_EXTRA_EMAILS) return badRequest("tooManyAlertEmails");
        if (extraEmails.some(e => e.length > 254 || !EMAIL.test(e))) return badRequest("invalidEmail");

        const db = await getDb();
        const clients = db.collection<Organization>("clients");
        const organization = await clients.findOne({ _id: clientId, ...OPEN_ORGANIZATION }, { projection: { name: 1, alerts: 1 } });
        if (!organization) return notFound();

        const settings: AlertSettings = { lowStockEmail: body.lowStockEmail, extraEmails };
        await clients.updateOne({ _id: clientId }, { $set: { alerts: settings } });
        await logAudit(AUDIT_ACTIONS.UPDATE_ALERTS, {
            actor: session.user,
            clientId,
            target: { type: "organization", id: clientId, label: organization.name },
            details: { before: alertSettingsOf(organization), after: settings },
        });

        return NextResponse.json(settings);
    } catch (error) {
        console.error("Update alert settings error:", error);
        return serverError();
    }
}
