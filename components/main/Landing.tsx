import { useTranslations } from "next-intl";
import Link from "next/link";
import { SignIn } from "@/components/AuthButtons";
import LegalLinks from "@/components/legal/LegalLinks";

export default function Landing() {
    const t = useTranslations("landing");
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
            <div className="inline-block px-4 py-1.5 mb-6 text-sm font-medium tracking-wider uppercase border rounded-full border-purple-500/30 bg-purple-500/10 text-purple-400">
                {t("badge")}
            </div>
            <h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-6 bg-linear-to-b from-white to-purple-400 bg-clip-text text-transparent">
                TEMPI
            </h1>
            <p className="max-w-xl text-lg text-gray-400 mb-10 leading-relaxed">
                {t("tagline")}
            </p>
            <SignIn />
            <p className="max-w-md mt-6 text-xs text-gray-500">
                {t.rich("legalNotice", {
                    privacy: (chunks) => <Link href="/privacy" className="underline hover:text-white">{chunks}</Link>,
                    terms: (chunks) => <Link href="/terms" className="underline hover:text-white">{chunks}</Link>,
                })}
            </p>
            <footer className="mt-16">
                <LegalLinks />
            </footer>
        </div>
    )
}