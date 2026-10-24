import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { badRequest, getDb, notFound, serverError, toObjectId } from "@/lib/api";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/constants";
import { currencyOf, isCurrency } from "@/lib/currency";
import { OPEN_ORGANIZATION } from "@/lib/organizations";
import type { Organization } from "@/types/models";

/**
 * PATCH /api/admin/organization/currency
 * Sets the currency the active organization's costs are in. Admins only. Costs aren't converted: only how they show.
 * Body: { currency } (an ISO code of CURRENCIES, lib/currency.ts). Returns { currency }.
 */
export async function PATCH(req: Request) {
    const { session, error } = await requirePermission(PERMISSIONS.MANAGE_USERS);
    if (error) return error;

    try {
        const clientId = toObjectId(session.user.clientId);
        if (!clientId) return badRequest("missingOrganizationId");
        const body = await req.json().catch(() => null);
        if (!isCurrency(body?.currency)) return badRequest("invalidCurrency");

        const db = await getDb();
        const clients = db.collection<Organization>("clients");
        const organization = await clients.findOne({ _id: clientId, ...OPEN_ORGANIZATION }, { projection: { name: 1, currency: 1 } });
        if (!organization) return notFound();

        await clients.updateOne({ _id: clientId }, { $set: { currency: body.currency } });
        await logAudit(AUDIT_ACTIONS.UPDATE_CURRENCY, {
            actor: session.user,
            clientId,
            target: { type: "organization", id: clientId, label: organization.name },
            details: { before: currencyOf(organization), after: body.currency },
        });
        return NextResponse.json({ currency: body.currency });
    } catch (error) {
        console.error("Update currency error:", error);
        return serverError();
    }
}
