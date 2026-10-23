import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import LegalDocument from "@/components/legal/LegalDocument";

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("legal.terms");
    return { title: `${t("title")} | TEMPI` };
}

// Public page: it is not in the proxy matcher, so no session is needed
export default function TermsPage() {
    return (
        <LegalDocument
            document="terms"
            sections={["acceptance", "service", "accounts", "organizations", "acceptableUse", "data", "availability", "termination", "liability", "law", "changes"]}
        />
    );
}
