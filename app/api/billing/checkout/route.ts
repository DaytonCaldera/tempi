import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { apiError, badRequest, serverError, unauthorized } from "@/lib/api";
import { isBillingInterval, organizationCheckout } from "@/lib/checkout";

/**
 * POST /api/billing/checkout - Starts paying for a plan. Body: { planId, interval: "monthly" | "yearly" }
 * Returns { url }: the Lemon Squeezy checkout, or its customer portal when the organization already has a
 * subscription. Only the organization's owner can pay (lib/checkout.ts).
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    try {
        const { planId, interval } = await req.json();
        if (!isBillingInterval(interval)) return badRequest();

        const result = await organizationCheckout(session, planId, interval, new URL("/admin/plan?checkout=success", req.url).toString());
        if (result.error) return apiError(result.error, result.status);
        return NextResponse.json({ url: result.url });
    } catch (error) {
        console.error("Checkout error:", error);
        return serverError();
    }
}
