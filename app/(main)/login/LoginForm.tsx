"use client"
import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Mail } from "lucide-react";
import Button from "@/components/ui/Button";
import type { SignInMethods } from "@/lib/auth-methods";

/** Auth.js error codes with their own message under "login.errors". The rest get "login.errors.default". */
const KNOWN_ERRORS = ["OAuthAccountNotLinked", "EmailSignin", "Verification", "AccessDenied"] as const;

function GoogleIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9h-4v3.1A12 12 0 0 0 12 24z" />
            <path fill="#FBBC05" d="M5.3 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3z" />
            <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c1-2.8 3.6-4.9 6.7-4.9z" />
        </svg>
    );
}

function MicrosoftIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
            <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
            <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
            <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
        </svg>
    );
}

export default function LoginForm({ methods, error, redirectTo }: { methods: SignInMethods; error?: string; redirectTo: string }) {
    const t = useTranslations("login");
    const [email, setEmail] = useState("");
    // Set while a provider redirects away, so a second click doesn't start another sign-in
    const [pending, setPending] = useState<string | null>(null);

    const start = (provider: string, options?: Record<string, string>) => {
        setPending(provider);
        // Email links navigate to /login/check-email; OAuth providers leave the site
        signIn(provider, { redirectTo, ...options });
    };

    const errorKey = error && (KNOWN_ERRORS.includes(error as typeof KNOWN_ERRORS[number]) ? error : "default");

    return (
        <div className="flex min-h-screen items-center justify-center px-4 py-12">
            <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-8">
                <h1 className="mb-2 text-2xl font-semibold tracking-tight text-ink">{t("title")}</h1>
                <p className="mb-8 text-sm text-ink-muted">{t("subtitle")}</p>

                {errorKey && (
                    <p role="alert" className="mb-6 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
                        {t(`errors.${errorKey}`)}
                    </p>
                )}

                <div className="flex flex-col gap-3">
                    <Button variant="secondary" disabled={!!pending} onClick={() => start("google")} className="inline-flex items-center justify-center gap-3">
                        <GoogleIcon />
                        {t("google")}
                    </Button>
                    {methods.microsoft && (
                        <Button variant="secondary" disabled={!!pending} onClick={() => start("microsoft-entra-id")} className="inline-flex items-center justify-center gap-3">
                            <MicrosoftIcon />
                            {t("microsoft")}
                        </Button>
                    )}
                </div>

                {methods.email && (
                    <>
                        <div className="my-6 flex items-center gap-3 text-xs text-ink-subtle">
                            <span className="h-px flex-1 bg-line" />
                            {t("or")}
                            <span className="h-px flex-1 bg-line" />
                        </div>
                        <form
                            onSubmit={(e) => { e.preventDefault(); start("resend", { email }); }}
                            className="flex flex-col gap-3"
                        >
                            <label htmlFor="login-email" className="text-sm font-medium text-ink">{t("emailLabel")}</label>
                            <input
                                id="login-email"
                                type="email"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={t("emailPlaceholder")}
                                className="rounded-full border border-line bg-canvas px-5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            />
                            <Button type="submit" disabled={!!pending} className="inline-flex items-center justify-center gap-2">
                                <Mail className="h-4 w-4" />
                                {pending === "resend" ? t("sending") : t("emailButton")}
                            </Button>
                        </form>
                    </>
                )}

                <p className="mt-8 text-xs text-ink-subtle">
                    {t.rich("legalNotice", {
                        privacy: (chunks) => <Link href="/privacy" className="underline hover:text-ink">{chunks}</Link>,
                        terms: (chunks) => <Link href="/terms" className="underline hover:text-ink">{chunks}</Link>,
                    })}
                </p>
            </div>
        </div>
    );
}
