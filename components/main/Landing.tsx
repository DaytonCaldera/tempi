import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowRight, Check, Coffee, Moon, Sprout, Users } from "lucide-react";
import LegalLinks from "@/components/legal/LegalLinks";
import ThemeToggle from "@/components/ThemeToggle";
import PricingTable from "@/components/plan/PricingTable";
import type { PlanSummary } from "@/lib/plans";

/** Rows of the closing report shown in the hero, keyed under "landing.moment.rows". */
const MOMENT_ROWS = ["out", "used", "returned", "missing"] as const;
/** Before/after pairs under "landing.overcome.items". */
const OVERCOME_ITEMS = ["recount", "messages", "losses", "buying"] as const;
const GAINS = [
    { key: "peace", Icon: Moon },
    { key: "team", Icon: Users },
    { key: "growth", Icon: Sprout },
] as const;

function GetStarted({ label }: { label: string }) {
    return (
        <Link href="/login" className="group inline-flex items-center gap-2 rounded-full bg-inverse px-7 py-3.5 text-sm font-semibold text-on-inverse transition hover:bg-accent hover:text-on-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">
            {label}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
    );
}

/**
 * Public home page. It sells the outcome (the calm of a day that closes with numbers that add up),
 * not the feature list: visitors should picture themselves after the event, not learn the screens.
 */
export default function Landing({ plans }: { plans: PlanSummary[] }) {
    const t = useTranslations("landing");
    const tPricing = useTranslations("pricing");
    return (
        <div className="text-left font-(family-name:--font-geist-sans) overflow-x-clip">
            <header className="flex items-center justify-between gap-4">
                <Link href="/" className="text-sm font-bold tracking-[0.2em] text-ink">VITALLIZ</Link>
                <nav className="flex items-center gap-5 text-sm font-medium">
                    {plans.length > 0 && <a href="#pricing" className="text-ink-muted hover:text-ink">{tPricing("title")}</a>}
                    <Link href="/login" className="rounded-full border border-line px-4 py-2 text-ink hover:border-line-strong">{t("signIn")}</Link>
                </nav>
            </header>

            {/* Hero: the promise, next to the moment it comes true */}
            <section className="grid items-center gap-14 pt-6 pb-24 md:grid-cols-[1.15fr_1fr] md:pt-16">
                <div>
                    <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                        {t("hero.eyebrow")}
                    </p>
                    <h1 className="mb-6 text-5xl font-semibold leading-[1.05] tracking-tight text-balance md:text-7xl">
                        {t("hero.title")}
                    </h1>
                    <p className="mb-10 max-w-lg text-lg leading-relaxed text-ink-muted text-pretty">
                        {t("hero.subtitle")}
                    </p>
                    <GetStarted label={t("cta")} />
                    <p className="mt-5 max-w-sm text-xs text-ink-subtle">
                        {t.rich("legalNotice", {
                            privacy: (chunks) => <Link href="/privacy" className="underline hover:text-ink">{chunks}</Link>,
                            terms: (chunks) => <Link href="/terms" className="underline hover:text-ink">{chunks}</Link>,
                        })}
                    </p>
                </div>

                <figure className="relative">
                    <div aria-hidden className="absolute -inset-10 rounded-full bg-accent/10 blur-3xl" />
                    <div className="relative rounded-3xl border border-line bg-card p-6 shadow-2xl backdrop-blur md:p-8">
                        <div className="mb-6 flex items-center gap-2 text-xs text-ink-subtle">
                            <Coffee className="h-4 w-4" />
                            {t("moment.when")}
                        </div>
                        <p className="mb-5 text-sm font-medium text-ink-muted">{t("moment.report")}</p>
                        <dl className="divide-y divide-line">
                            {MOMENT_ROWS.map(row => (
                                <div key={row} className="flex items-baseline justify-between py-3">
                                    <dt className="text-sm text-ink-subtle">{t(`moment.rows.${row}.label`)}</dt>
                                    <dd className={`font-mono text-lg tabular-nums ${row === "missing" ? "text-accent" : "text-ink"}`}>
                                        {t(`moment.rows.${row}.value`)}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-accent/10 px-4 py-3 text-accent">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-on-accent">
                                <Check className="h-4 w-4" strokeWidth={3} />
                            </span>
                            <span className="font-medium">{t("moment.verdict")}</span>
                        </div>
                    </div>
                    <figcaption className="relative mt-5 text-center text-sm text-ink-subtle italic">
                        {t("moment.caption")}
                    </figcaption>
                </figure>
            </section>

            {/* What they leave behind */}
            <section className="border-t border-line py-24">
                <h2 className="mb-3 text-3xl font-semibold tracking-tight md:text-4xl">{t("overcome.title")}</h2>
                <p className="mb-12 max-w-xl text-ink-muted">{t("overcome.subtitle")}</p>
                <ul className="divide-y divide-line border-y border-line">
                    {OVERCOME_ITEMS.map(item => (
                        <li key={item} className="grid gap-2 py-6 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-8">
                            <span className="text-ink-subtle line-through decoration-line-strong">{t(`overcome.items.${item}.before`)}</span>
                            <ArrowRight className="hidden h-4 w-4 text-ink-subtle md:block" />
                            <span className="text-lg text-ink">{t(`overcome.items.${item}.after`)}</span>
                        </li>
                    ))}
                </ul>
            </section>

            {/* What they gain, for the mind and for the business */}
            <section className="py-24">
                <h2 className="mb-12 text-3xl font-semibold tracking-tight md:text-4xl">{t("gains.title")}</h2>
                <div className="grid gap-6 md:grid-cols-3">
                    {GAINS.map(({ key, Icon }) => (
                        <div key={key} className="rounded-3xl border border-line bg-card p-7">
                            <Icon className="mb-6 h-6 w-6 text-accent" />
                            <h3 className="mb-2 text-xl font-semibold">{t(`gains.${key}.title`)}</h3>
                            <p className="leading-relaxed text-ink-muted">{t(`gains.${key}.description`)}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Prices, so visitors can pick a plan and pay without asking anyone (/checkout) */}
            {plans.length > 0 && (
                <section id="pricing" className="scroll-mt-8 border-t border-line py-24">
                    <div className="mx-auto mb-12 max-w-2xl text-center">
                        <h2 className="mb-3 text-3xl font-semibold tracking-tight md:text-4xl">{tPricing("title")}</h2>
                        <p className="text-ink-muted">{tPricing("subtitle")}</p>
                    </div>
                    <PricingTable plans={plans} mode="public" />
                    <p className="mt-8 text-center text-sm">
                        <Link href="/pricing" className="text-ink-muted underline hover:text-ink">{t("pricingDetails")}</Link>
                    </p>
                </section>
            )}

            {/* Closing call */}
            <section className="flex flex-col items-center border-t border-line py-24 text-center">
                <h2 className="mb-4 max-w-2xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
                    {t("closing.title")}
                </h2>
                <p className="mb-10 text-ink-muted">{t("closing.subtitle")}</p>
                <GetStarted label={t("cta")} />
            </section>

            <footer className="flex flex-col items-center gap-5 pb-4">
                <LegalLinks />
                <ThemeToggle />
            </footer>
        </div>
    );
}
