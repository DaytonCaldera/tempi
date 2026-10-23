import { useTranslations } from "next-intl";
import { SignIn } from "@/components/AuthButtons";

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
        </div>
    )
}