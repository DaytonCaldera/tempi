import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import AuthProvider from "@/components/SessionProvider";
import TimeZoneSync from "@/components/TimeZoneSync";
import { Geist, Geist_Mono } from 'next/font/google';
import '@/app/globals.css';
import { THEME_SCRIPT } from '@/lib/theme-script';
import DashboardClientWrapper from "./DashboardClientWrapper";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("metadata");
    return { title: t("title"), description: t("description") };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const locale = await getLocale();

    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                {/* Sets the theme before the first paint. A plain <script>: next/script would run it after hydration */}
                <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
            </head>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-canvas text-ink selection:bg-accent/30`}>
                <AuthProvider>
                    {/* Inherits locale, messages and timeZone from i18n/request.ts */}
                    <NextIntlClientProvider>
                        <TimeZoneSync />
                        <DashboardClientWrapper>
                            {children}
                        </DashboardClientWrapper>
                    </NextIntlClientProvider>
                </AuthProvider>
            </body>
        </html>
    );
}