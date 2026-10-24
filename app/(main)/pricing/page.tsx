import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import LegalLinks from "@/components/legal/LegalLinks";
import ThemeToggle from "@/components/ThemeToggle";
import PricingTable from "@/components/plan/PricingTable";
import { LEGAL } from "@/lib/constants";
import { listCatalogPlans } from "@/lib/plans";

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("pricing");
    return { title: `${t("title")} | Vitalliz`, description: t("subtitle") };
}

// The catalog is edited from /superadmin/plans: always read it fresh
export const dynamic = "force-dynamic";

/** Public pricing page: the Free, Pro and Business plans (never the custom ones). Not in the proxy matcher. */
export default async function PricingPage() {
    const [t, plans] = await Promise.all([getTranslations("pricing"), listCatalogPlans()]);

    return (
        <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
            <Link href="/" className="text-sm text-ink-muted hover:text-ink">← Vitalliz</Link>

            <header className="mx-auto mt-8 mb-12 max-w-2xl text-center">
                <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">{t("title")}</h1>
                <p className="mt-4 text-ink-muted">{t("subtitle")}</p>
            </header>

            <PricingTable plans={plans} mode="public" />

            <section className="mx-auto mt-16 grid max-w-4xl gap-6 md:grid-cols-3">
                {(["flat", "noLoss", "custom"] as const).map(key => (
                    <div key={key} className="rounded-3xl border border-line bg-card p-6">
                        <h2 className="mb-2 font-semibold">{t(`faq.${key}.title`)}</h2>
                        <p className="text-sm leading-relaxed text-ink-muted">{t(`faq.${key}.body`, { email: LEGAL.contactEmail })}</p>
                    </div>
                ))}
            </section>

            <footer className="mt-16 flex flex-col items-center gap-5">
                <LegalLinks />
                <ThemeToggle />
            </footer>
        </div>
    );
}
