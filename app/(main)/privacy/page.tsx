import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import LegalDocument from "@/components/legal/LegalDocument";

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("legal.privacy");
    return { title: `${t("title")} | Vitalliz` };
}

// Public page: it is not in the proxy matcher, so no session is needed
export default function PrivacyPage() {
    return (
        <LegalDocument
            document="privacy"
            sections={["collect", "google", "use", "sharing", "storage", "retention", "rights", "cookies", "children", "changes"]}
        />
    );
}
