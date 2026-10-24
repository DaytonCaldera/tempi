import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CreditCard } from "lucide-react";
import { auth } from "@/auth";
import type { ErrorKey } from "@/lib/api";
import { isBillingInterval, organizationCheckout } from "@/lib/checkout";
import { PERMISSIONS, ROLES } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";

/**
 * Sign-up and pay in one go, from the paid plans on /pricing and the home page: /checkout?plan=<id>&interval=monthly|yearly
 * Each step sends the visitor on and back here until they can pay: sign in (/login), create their organization
 * (/lobby), then the Lemon Squeezy checkout, which returns to /admin/plan. Not in the proxy matcher: it checks the
 * session itself so signed-out visitors keep the plan they picked.
 */
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string; interval?: string }> }) {
    const [session, { plan, interval: rawInterval }] = await Promise.all([auth(), searchParams]);
    if (!plan) redirect("/pricing");
    const interval = isBillingInterval(rawInterval) ? rawInterval : "monthly";
    const intent = new URLSearchParams({ plan, interval }).toString();

    if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent(`/checkout?${intent}`)}`);
    if (session.user.isActive === false) redirect("/unauthorized");
    if (session.user.role === ROLES.SUPERADMIN) redirect("/superadmin");
    // No organization yet: the lobby creates it and comes back here
    if (!session.user.clientId || !session.user.role || session.user.role === ROLES.NEW_USER) redirect(`/lobby?${intent}`);
    // Waiting for approval in someone else's organization: nothing to pay for
    if (session.user.role === ROLES.PENDING_USER) redirect("/");

    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;

    let result: Awaited<ReturnType<typeof organizationCheckout>> | null = null;
    try {
        result = await organizationCheckout(session, plan, interval, `${origin}/admin/plan?checkout=success`);
    } catch (e) {
        console.error("Checkout page error:", e);
    }
    // Outside the try: redirect() throws to do its job
    if (result?.url) redirect(result.url);
    const error: ErrorKey | "checkoutFailed" = result?.error ?? "checkoutFailed";

    const [t, tErrors, tPricing] = await Promise.all([getTranslations("checkout"), getTranslations("errors"), getTranslations("pricing")]);
    const canManagePlan = hasPermission(session, PERMISSIONS.MANAGE_USERS);

    return (
        <div className="flex min-h-screen items-center justify-center px-4 py-12">
            <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-8 text-center">
                <CreditCard className="mx-auto mb-6 h-8 w-8 text-accent" aria-hidden />
                <h1 className="mb-3 text-2xl font-semibold tracking-tight text-ink">{t("title")}</h1>
                <p role="alert" className="mb-8 text-sm leading-relaxed text-ink-muted">
                    {error === "checkoutFailed" ? tPricing("checkoutFailed") : tErrors(error)}
                </p>
                <Link href={canManagePlan ? "/admin/plan" : "/"} className="text-sm font-medium text-ink underline hover:text-accent">
                    {canManagePlan ? t("toPlan") : t("toHome")}
                </Link>
            </div>
        </div>
    );
}
