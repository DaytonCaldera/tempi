import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css";
import { getLocale, getTranslations } from "next-intl/server";

import AuthProvider from "@/components/SessionProvider";
import TimeZoneSync from "@/components/TimeZoneSync";
import { NextIntlClientProvider } from "next-intl";
import { THEME_SCRIPT } from "@/lib/theme-script";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("metadata");
    return { title: t("title"), description: t("description") };
}

export default async function MainLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const locale = await getLocale();

    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                {/* Sets the theme before the first paint. A plain <script>: next/script would run it after hydration */}
                <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
            </head>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                <main className="min-h-screen bg-canvas text-ink selection:bg-accent/30">
                    <AuthProvider>
                        {/* Inherits locale, messages and timeZone from i18n/request.ts */}
                        <NextIntlClientProvider>
                            <TimeZoneSync />
                            {children}
                        </NextIntlClientProvider>
                    </AuthProvider>
                </main>
            </body>
        </html>
    );
}
