import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { LEGAL } from "@/lib/constants";
import LegalLinks from "@/components/legal/LegalLinks";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";

interface Props {
    /** Messages namespace under "legal" ("privacy" or "terms"). */
    document: "privacy" | "terms";
    /** Section keys under legal.<document>.sections, in display order. */
    sections: string[];
}

/**
 * Renders a legal page from the "legal" messages. Each section has a title and a list of
 * paragraphs (read with t.raw), plus optional bullet points.
 */
export default async function LegalDocument({ document, sections }: Props) {
    const t = await getTranslations(`legal.${document}`);
    const tLegal = await getTranslations("legal");
    const format = await getFormatter();

    const contactLink = (
        <a href={`mailto:${LEGAL.contactEmail}`} className="text-accent hover:underline">
            {LEGAL.contactEmail}
        </a>
    );

    return (
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-12">
            <Link href="/" className="text-sm text-ink-muted hover:text-ink">
                ← TEMPI
            </Link>

            <h1 className="mt-6 text-4xl font-semibold tracking-tight">{t("title")}</h1>
            <p className="mt-2 text-sm text-ink-subtle">
                {tLegal("lastUpdated", { date: format.dateTime(new Date(LEGAL.effectiveDate), { dateStyle: "long", timeZone: "UTC" }) })}
            </p>

            <p className="mt-8 text-ink-muted leading-relaxed">{t("intro")}</p>

            {sections.map((key, index) => {
                const paragraphs = t.raw(`sections.${key}.paragraphs`) as string[];
                const bullets = t.has(`sections.${key}.bullets`) ? (t.raw(`sections.${key}.bullets`) as string[]) : [];
                return (
                    <section key={key} className="mt-10">
                        <h2 className="text-xl font-semibold text-ink">
                            {index + 1}. {t(`sections.${key}.title`)}
                        </h2>
                        {paragraphs.map((text, i) => (
                            <p key={i} className="mt-3 text-ink-muted leading-relaxed">{text}</p>
                        ))}
                        {bullets.length > 0 && (
                            <ul className="mt-3 list-disc pl-6 space-y-2 text-ink-muted leading-relaxed">
                                {bullets.map((text, i) => <li key={i}>{text}</li>)}
                            </ul>
                        )}
                    </section>
                );
            })}

            <section className="mt-10">
                <h2 className="text-xl font-semibold text-ink">
                    {sections.length + 1}. {tLegal("contactTitle")}
                </h2>
                <p className="mt-3 text-ink-muted leading-relaxed">
                    {tLegal.rich("contactBody", { email: () => contactLink })}
                </p>
            </section>

            <footer className="mt-16 pt-6 border-t border-line flex flex-col items-center gap-5">
                <LegalLinks />
                <ThemeToggle />
            </footer>

            <LanguageSwitcher />
        </div>
    );
}
