import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { getDb, toObjectId } from "@/lib/api";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { verifyWebhookSignature } from "@/lib/billing";
import { forgetCachedPlans } from "@/lib/plans";
import type { Organization, Plan, Subscription, SubscriptionStatus } from "@/types/models";

/** Subscription events this endpoint listens to (pick them in Lemon Squeezy → Settings → Webhooks). */
const SUBSCRIPTION_EVENTS = new Set([
    "subscription_created", "subscription_updated", "subscription_cancelled", "subscription_resumed",
    "subscription_expired", "subscription_paused", "subscription_unpaused",
    "subscription_payment_failed", "subscription_payment_success", "subscription_payment_recovered",
]);

const STATUSES: SubscriptionStatus[] = ["on_trial", "active", "paused", "past_due", "unpaid", "cancelled", "expired"];
const UNPAID: SubscriptionStatus[] = ["past_due", "unpaid"];

const dateOrNull = (value: unknown) => typeof value === "string" ? new Date(value) : null;

/**
 * POST /api/billing/webhook - Lemon Squeezy tells Vitalliz that a subscription changed.
 * Writes clients.subscription; the plan that applies is worked out from it on every read (lib/plans.ts), so
 * clients.planId (the free plan, or one the superadmin assigned) is never touched and a missed "expired" event
 * can't keep a plan forever: a cancelled subscription stops giving access at its ends_at anyway.
 * - Only requests signed with LEMONSQUEEZY_WEBHOOK_SECRET are accepted (401 otherwise).
 * - Events can arrive twice or out of order: an event older than the stored subscription is ignored.
 * - Answers 200 to events it doesn't handle, so Lemon Squeezy doesn't retry them.
 */
export async function POST(req: Request) {
    const rawBody = await req.text();
    if (!verifyWebhookSignature(rawBody, req.headers.get("x-signature"))) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const event: string = payload?.meta?.event_name ?? "";
    // Payment events carry the invoice, not the subscription: the subscription_updated that follows them is used
    if (!SUBSCRIPTION_EVENTS.has(event) || payload?.data?.type !== "subscriptions") return NextResponse.json({ ignored: event });

    const attributes = payload.data.attributes ?? {};
    const subscriptionId = String(payload.data.id);
    const custom = payload.meta.custom_data ?? {};
    const status = STATUSES.includes(attributes.status) ? attributes.status as SubscriptionStatus : null;
    if (!status) return NextResponse.json({ ignored: `status ${attributes.status}` });

    try {
        const db = await getDb();
        // The checkout's custom data says which organization; later events can also be matched by subscription id
        const clientId = toObjectId(custom.client_id);
        const organization = await db.collection<Organization>("clients").findOne(
            clientId ? { _id: clientId } : { "subscription.id": subscriptionId },
            { projection: { name: 1, subscription: 1 } }
        );
        if (!organization) {
            console.error(`Billing webhook ${event}: no organization for subscription ${subscriptionId}`);
            return NextResponse.json({ ignored: "unknown organization" });
        }

        const planId = await subscriptionPlan(custom.plan_id, String(attributes.variant_id ?? ""), organization.subscription);
        if (!planId) {
            console.error(`Billing webhook ${event}: no plan for variant ${attributes.variant_id} (subscription ${subscriptionId})`);
            return NextResponse.json({ ignored: "unknown plan" });
        }

        const updatedAt = dateOrNull(attributes.updated_at) ?? new Date();
        const previous = organization.subscription;
        if (previous?.id === subscriptionId && previous.updatedAt && new Date(previous.updatedAt) > updatedAt) {
            return NextResponse.json({ ignored: "older event" });
        }

        const subscription: Subscription = {
            provider: "lemonsqueezy",
            id: subscriptionId,
            status,
            planId,
            variantId: String(attributes.variant_id ?? ""),
            renewsAt: dateOrNull(attributes.renews_at),
            endsAt: dateOrNull(attributes.ends_at),
            // Kept from the first unpaid event, so retries don't extend the grace period
            pastDueSince: UNPAID.includes(status) ? (previous?.id === subscriptionId && previous.pastDueSince) || updatedAt : null,
            portalUrl: attributes.urls?.customer_portal ?? previous?.portalUrl,
            updatedAt,
        };
        await db.collection<Organization>("clients").updateOne({ _id: organization._id }, { $set: { subscription } });
        forgetCachedPlans(organization._id);

        if (previous?.status !== status || !previous?.planId?.equals(planId)) {
            const plans = await db.collection<Plan>("plans").find({ _id: { $in: [planId, previous?.planId].filter((id): id is ObjectId => !!id) } }, { projection: { name: 1 } }).toArray();
            const nameOf = (id?: ObjectId) => plans.find(p => id && p._id.equals(id))?.name ?? null;
            await logAudit(AUDIT_ACTIONS.SUBSCRIPTION, {
                actor: { name: "Lemon Squeezy" },
                clientId: organization._id,
                target: { type: "organization", id: organization._id, label: organization.name },
                details: {
                    event,
                    subscriptionId,
                    status: { before: previous?.status ?? null, after: status },
                    plan: { before: nameOf(previous?.planId), after: nameOf(planId) },
                },
            });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        // 500 makes Lemon Squeezy retry the event later
        console.error(`Billing webhook ${event} failed:`, error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

/**
 * The plan a subscription pays for: the catalog plan sold with its variant (so a plan change made in the customer
 * portal is followed), else the plan in the checkout's custom data (custom plans share one generic variant),
 * else the plan already stored for it.
 */
async function subscriptionPlan(customPlanId: unknown, variantId: string, previous?: Subscription): Promise<ObjectId | null> {
    const plans = (await getDb()).collection<Plan>("plans");
    if (variantId) {
        const byVariant = await plans.findOne({ $or: [{ "billing.monthlyVariantId": variantId }, { "billing.yearlyVariantId": variantId }] }, { projection: { _id: 1 } });
        if (byVariant) return byVariant._id;
    }
    const fromCheckout = toObjectId(customPlanId);
    if (fromCheckout && await plans.findOne({ _id: fromCheckout }, { projection: { _id: 1 } })) return fromCheckout;
    return previous?.planId ?? null;
}
