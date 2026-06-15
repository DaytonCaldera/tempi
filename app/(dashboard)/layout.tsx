// ESTE ES UN SERVER COMPONENT (sin 'use client')
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import AuthProvider from "@/components/providers/SessionProvider";
import { Geist, Geist_Mono } from 'next/font/google';
import '@/app/globals.css';
import DashboardClientWrapper from "./DashboardClientWrapper";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = {
    title: "Vitalliz | Gestión de Inventario",
    description: "Sistema inteligente de logística y suministros",
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const messages = await getMessages();
    const locale = await getLocale();

    return (
        <html lang={locale}>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased text-black`}>
                <AuthProvider>
                    <NextIntlClientProvider messages={messages} locale={locale}>
                        <DashboardClientWrapper>
                            {children}
                        </DashboardClientWrapper>
                    </NextIntlClientProvider>
                </AuthProvider>
            </body>
        </html>
    );
}