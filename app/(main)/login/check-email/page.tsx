import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MailCheck } from "lucide-react";

/** Shown after an email link is requested (auth.ts pages.verifyRequest). */
export default async function CheckEmailPage() {
    const t = await getTranslations("login.checkEmail");
    return (
        <div className="flex min-h-screen items-center justify-center px-4 py-12">
            <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-8 text-center">
                <MailCheck className="mx-auto mb-6 h-8 w-8 text-accent" />
                <h1 className="mb-3 text-2xl font-semibold tracking-tight text-ink">{t("title")}</h1>
                <p className="mb-8 text-sm leading-relaxed text-ink-muted">{t("description")}</p>
                <Link href="/login" className="text-sm font-medium text-ink underline hover:text-accent">{t("retry")}</Link>
            </div>
        </div>
    );
}
