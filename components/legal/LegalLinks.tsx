import Link from "next/link";
import { useTranslations } from "next-intl";

/** Links to the privacy policy and terms. Google's OAuth verification needs them reachable from the home page. */
export default function LegalLinks() {
    const t = useTranslations("legal");
    const tPricing = useTranslations("pricing");
    return (
        <nav className="flex justify-center gap-6 text-sm text-ink-subtle">
            <Link href="/pricing" className="hover:text-ink">{tPricing("title")}</Link>
            <Link href="/privacy" className="hover:text-ink">{t("privacy.title")}</Link>
            <Link href="/terms" className="hover:text-ink">{t("terms.title")}</Link>
        </nav>
    );
}
