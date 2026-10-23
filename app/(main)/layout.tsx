import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css";
import { getLocale, getTranslations } from "next-intl/server";

import AuthProvider from "@/components/SessionProvider";
import { NextIntlClientProvider } from "next-intl";

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
        <html lang={locale}>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                <main className="min-h-screen bg-[#0a0a0c] text-white selection:bg-purple-500/30">
                    <AuthProvider>
                        {/* Inherits locale, messages and timeZone from i18n/request.ts */}
                        <NextIntlClientProvider>
                            {children}
                        </NextIntlClientProvider>
                    </AuthProvider>
                </main>
            </body>
        </html>
    );
}
