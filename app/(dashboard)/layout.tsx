import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import AuthProvider from "@/components/SessionProvider";
import { Geist, Geist_Mono } from 'next/font/google';
import '@/app/globals.css';
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
        <html lang={locale}>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased text-black`}>
                <AuthProvider>
                    {/* Inherits locale, messages and timeZone from i18n/request.ts */}
                    <NextIntlClientProvider>
                        <DashboardClientWrapper>
                            {children}
                        </DashboardClientWrapper>
                    </NextIntlClientProvider>
                </AuthProvider>
            </body>
        </html>
    );
}