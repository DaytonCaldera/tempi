import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "@/app/globals.css";
import AuthProvider from "@/components/SessionProvider";
import SuperadminNav from "@/components/superadmin/SuperadminNav";
import { requireSuperadmin } from "@/lib/superadmin";
import { THEME_SCRIPT } from "@/lib/theme-script";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("superadmin");
    return { title: `${t("panel")} · Vitalliz`, robots: { index: false, follow: false } };
}

/**
 * Root layout of the superadmin panel, a route group of its own: its navigation and pages never ship with the
 * organization pages. The proxy keeps everyone else out, and requireSuperadmin() checks again here and in every page.
 */
export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
    await requireSuperadmin();
    const locale = await getLocale();

    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                {/* Sets the theme before the first paint. A plain <script>: next/script would run it after hydration */}
                <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
            </head>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-canvas text-ink selection:bg-accent/30`}>
                <AuthProvider>
                    <NextIntlClientProvider>
                        <div className="min-h-screen md:flex">
                            <SuperadminNav />
                            <main className="min-w-0 flex-1 p-4 md:p-10">
                                <div className="mx-auto max-w-7xl">{children}</div>
                            </main>
                        </div>
                    </NextIntlClientProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
