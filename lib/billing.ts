import { createHmac, timingSafeEqual } from "crypto";
import type { Plan } from "@/types/models";

/**
 * Server only: Lemon Squeezy, the merchant of record that charges the subscriptions (it handles taxes and
 * invoices, and works for a seller in Costa Rica). Vitalliz never sees card details: the admin pays on Lemon
 * Squeezy's checkout, and its webhook (app/api/billing/webhook) tells Vitalliz what changed.
 * Docs: https://docs.lemonsqueezy.com/api
 */

const API_URL = "https://api.lemonsqueezy.com/v1";

/** Whether online payments are set up (without them, plans are only changed by the superadmin). */
export const billingConfigured = () => !!process.env.LEMONSQUEEZY_API_KEY && !!process.env.LEMONSQUEEZY_STORE_ID;

async function lemonSqueezy(path: string, init: RequestInit = {}) {
    const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
            Accept: "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json",
            Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
            ...init.headers,
        },
        cache: "no-store",
    });
    if (!res.ok) throw new Error(`Lemon Squeezy ${init.method ?? "GET"} ${path} failed with ${res.status}: ${await res.text()}`);
    return res.status === 204 ? null : res.json();
}

export type BillingInterval = "monthly" | "yearly";

/**
 * The generic variants custom plans are sold through, one per interval: a Lemon Squeezy variant charges on its own
 * interval, so the yearly price must go through a yearly variant. LEMONSQUEEZY_CUSTOM_VARIANT_ID is the old name
 * of the monthly one.
 */
export const customVariantIds = () => ({
    monthly: process.env.LEMONSQUEEZY_CUSTOM_MONTHLY_VARIANT_ID || process.env.LEMONSQUEEZY_CUSTOM_VARIANT_ID || undefined,
    yearly: process.env.LEMONSQUEEZY_CUSTOM_YEARLY_VARIANT_ID || undefined,
});

/**
 * The Lemon Squeezy variant to sell for a plan, and the price to charge when it isn't the variant's own.
 * Catalog plans have a variant per interval (plans.billing, set by scripts/seed-plans.js). Custom plans are
 * sold through the generic variant of the interval (customVariantIds) with the plan's price as a custom price,
 * which Lemon Squeezy also uses for every renewal.
 * @returns null when the plan can't be bought online with that interval.
 */
export function checkoutVariant(plan: Plan, interval: BillingInterval): { variantId: string; customPrice?: number } | null {
    if (plan.billingMode === "manual" || !(Number(plan.price) > 0)) return null;
    if (plan.isCustom) {
        if (interval === "yearly" && !(Number(plan.priceYearly) > 0)) return null;
        const variantId = customVariantIds()[interval];
        const price = interval === "yearly" ? Number(plan.priceYearly) : Number(plan.price);
        return variantId ? { variantId, customPrice: Math.round(price * 100) } : null;
    }
    const variantId = interval === "yearly" ? plan.billing?.yearlyVariantId : plan.billing?.monthlyVariantId;
    return variantId ? { variantId } : null;
}

/**
 * How often a variant charges: from the catalog plans and the custom variants when it is one of them, else asked to
 * Lemon Squeezy (a variant created later, or changed in its dashboard).
 * @returns null when it isn't monthly or yearly (e.g. every 3 months), or Lemon Squeezy can't be reached.
 */
export async function variantInterval(variantId: string, plans: Pick<Plan, "billing">[]): Promise<BillingInterval | null> {
    const custom = customVariantIds();
    if (custom.monthly === variantId || plans.some(p => p.billing?.monthlyVariantId === variantId)) return "monthly";
    if (custom.yearly === variantId || plans.some(p => p.billing?.yearlyVariantId === variantId)) return "yearly";
    try {
        const json = await lemonSqueezy(`/variants/${encodeURIComponent(variantId)}`);
        const { interval, interval_count: count } = json.data.attributes;
        if (Number(count ?? 1) !== 1) return null;
        return interval === "month" ? "monthly" : interval === "year" ? "yearly" : null;
    } catch (error) {
        console.error(`Could not read the interval of variant ${variantId}:`, error);
        return null;
    }
}

/**
 * Creates a checkout for one organization and returns its URL. The organization and plan travel as custom
 * data, which Lemon Squeezy sends back in every webhook of the subscription.
 */
export async function createCheckout({ variantId, customPrice, clientId, planId, email, name, redirectUrl }: {
    variantId: string; customPrice?: number; clientId: string; planId: string; email?: string | null; name?: string | null; redirectUrl: string;
}): Promise<string> {
    const body = {
        data: {
            type: "checkouts",
            attributes: {
                ...(customPrice && { custom_price: customPrice }),
                product_options: { redirect_url: redirectUrl, enabled_variants: [Number(variantId)] },
                checkout_data: {
                    ...(email && { email }),
                    ...(name && { name }),
                    custom: { client_id: clientId, plan_id: planId },
                },
                test_mode: process.env.LEMONSQUEEZY_TEST_MODE === "true",
            },
            relationships: {
                store: { data: { type: "stores", id: String(process.env.LEMONSQUEEZY_STORE_ID) } },
                variant: { data: { type: "variants", id: String(variantId) } },
            },
        },
    };
    const json = await lemonSqueezy("/checkouts", { method: "POST", body: JSON.stringify(body) });
    return json.data.attributes.url as string;
}

/** Cancels a subscription (it keeps access until the end of the paid period, see subscriptionGivesAccess). */
export async function cancelSubscription(subscriptionId: string) {
    await lemonSqueezy(`/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "DELETE" });
}

async function updateSubscription(subscriptionId: string, attributes: Record<string, unknown>) {
    await lemonSqueezy(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
        method: "PATCH",
        body: JSON.stringify({ data: { type: "subscriptions", id: String(subscriptionId), attributes } }),
    });
}

/**
 * Moves a subscription to another variant (plan or interval).
 * - "now": prorated and charged right away (an upgrade): the unused time of the old variant is credited.
 * - "nextRenewal": no proration, the new price is charged at the next renewal (a downgrade).
 */
export async function changeSubscriptionVariant(subscriptionId: string, variantId: string, charge: "now" | "nextRenewal") {
    await updateSubscription(subscriptionId, {
        variant_id: Number(variantId),
        ...(charge === "now" ? { invoice_immediately: true } : { disable_prorations: true }),
    });
}

/** Undoes a cancellation before the subscription ends: it renews on its usual date. */
export async function resumeSubscription(subscriptionId: string) {
    await updateSubscription(subscriptionId, { cancelled: false });
}

export type PaidInvoice = { id: string; total: number; createdAt: Date };

/** The subscription's latest paid invoice that hasn't been refunded (cents in `total`), or null. */
export async function latestPaidInvoice(subscriptionId: string): Promise<PaidInvoice | null> {
    const query = new URLSearchParams({ "filter[subscription_id]": subscriptionId, "filter[status]": "paid", "filter[refunded]": "false", "page[size]": "1" });
    const json = await lemonSqueezy(`/subscription-invoices?${query}`);
    const invoice = json.data?.[0];
    if (!invoice) return null;
    return { id: String(invoice.id), total: Number(invoice.attributes.total) || 0, createdAt: new Date(invoice.attributes.created_at) };
}

/** Refunds a whole invoice. The money goes back to the card it was paid with (Lemon Squeezy does it). */
export async function refundInvoice(invoiceId: string) {
    await lemonSqueezy(`/subscription-invoices/${encodeURIComponent(invoiceId)}/refund`, {
        method: "POST",
        body: JSON.stringify({ data: { type: "subscription-invoices", id: String(invoiceId), attributes: {} } }),
    });
}

/** Whether a webhook really comes from Lemon Squeezy: X-Signature is the HMAC-SHA256 of the raw body. */
export function verifyWebhookSignature(rawBody: string, signature: string | null) {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret || !signature) return false;
    const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"), "utf8");
    const received = Buffer.from(signature, "utf8");
    return expected.length === received.length && timingSafeEqual(expected, received);
}
