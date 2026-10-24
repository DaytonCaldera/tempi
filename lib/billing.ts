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
 * The Lemon Squeezy variant to sell for a plan, and the price to charge when it isn't the variant's own.
 * Catalog plans have a variant per interval (plans.billing, set by scripts/seed-plans.js). Custom plans are
 * sold through one generic variant (LEMONSQUEEZY_CUSTOM_VARIANT_ID) with the plan's price as a custom price,
 * which Lemon Squeezy also uses for every renewal.
 * @returns null when the plan can't be bought online.
 */
export function checkoutVariant(plan: Plan, interval: BillingInterval): { variantId: string; customPrice?: number } | null {
    if (plan.billingMode === "manual" || !(Number(plan.price) > 0)) return null;
    if (plan.isCustom) {
        const variantId = process.env.LEMONSQUEEZY_CUSTOM_VARIANT_ID;
        const price = interval === "yearly" && Number(plan.priceYearly) > 0 ? Number(plan.priceYearly) : Number(plan.price);
        return variantId ? { variantId, customPrice: Math.round(price * 100) } : null;
    }
    const variantId = interval === "yearly" ? plan.billing?.yearlyVariantId : plan.billing?.monthlyVariantId;
    return variantId ? { variantId } : null;
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

/** Whether a webhook really comes from Lemon Squeezy: X-Signature is the HMAC-SHA256 of the raw body. */
export function verifyWebhookSignature(rawBody: string, signature: string | null) {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret || !signature) return false;
    const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"), "utf8");
    const received = Buffer.from(signature, "utf8");
    return expected.length === received.length && timingSafeEqual(expected, received);
}
