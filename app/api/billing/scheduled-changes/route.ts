import { NextResponse } from "next/server";
import { getDb } from "@/lib/api";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { billingConfigured, changeSubscriptionVariant } from "@/lib/billing";
import { forgetCachedPlans } from "@/lib/plans";
import { scheduledChangeAction } from "@/lib/subscription-changes";
import type { Organization } from "@/types/models";

/**
 * GET /api/billing/scheduled-changes - Daily job (a cron calls it with `Authorization: Bearer <CRON_SECRET>`).
 * Applies the downgrades that change the interval (e.g. yearly to monthly) just before the paid period ends: Lemon
 * Squeezy moves the billing date when the interval changes, so they can't be applied when the admin asks. A change
 * whose period already ended without it (the job didn't run) is dropped: the old variant renewed and was paid for.
 * Returns { applied, dropped, failed }.
 */
export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!billingConfigured()) return NextResponse.json({ applied: 0, dropped: 0, failed: 0 });

    const clients = (await getDb()).collection<Organization>("clients");
    const organizations = await clients.find(
        { "subscription.scheduledChange.applied": false },
        { projection: { name: 1, subscription: 1 } }
    ).toArray();

    const counts = { applied: 0, dropped: 0, failed: 0 };
    for (const organization of organizations) {
        const subscription = organization.subscription!;
        const change = subscription.scheduledChange!;
        const action = scheduledChangeAction(change);
        if (action === "wait") continue;

        // Only if it is still the same change, in case the admin undid it meanwhile
        const filter = { _id: organization._id, "subscription.id": subscription.id, "subscription.scheduledChange.applied": false };
        if (action === "drop") {
            await clients.updateOne(filter, { $set: { "subscription.scheduledChange": null } });
            console.error(`Scheduled change of subscription ${subscription.id} dropped: its period ended before it was applied`);
            counts.dropped++;
            continue;
        }
        try {
            await changeSubscriptionVariant(subscription.id, change.to.variantId, "nextRenewal");
            await clients.updateOne(filter, { $set: { "subscription.scheduledChange.applied": true } });
            forgetCachedPlans(organization._id);
            await logAudit(AUDIT_ACTIONS.SUBSCRIPTION_CHANGE, {
                actor: { name: "Vitalliz" },
                clientId: organization._id,
                target: { type: "organization", id: organization._id, label: organization.name },
                details: { kind: "scheduledApplied", interval: { before: change.from.interval, after: change.to.interval } },
            });
            counts.applied++;
        } catch (error) {
            // Tried again on the next run while the period lasts
            console.error(`Could not apply the scheduled change of subscription ${subscription.id}:`, error);
            counts.failed++;
        }
    }
    return NextResponse.json(counts);
}
