import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { SignOut } from "@/components/AuthButtons";

// How often to re-check if an admin approved the user
const APPROVAL_CHECK_INTERVAL = 15000;

export default function PendingApproval() {
    const t = useTranslations("pending");
    const { update } = useSession();

    // The session re-reads the membership for pending users, so once approved the home page redirects them
    useEffect(() => {
        const interval = setInterval(() => update(), APPROVAL_CHECK_INTERVAL);
        return () => clearInterval(interval);
    }, [update]);

    return (
        <div className="flex flex-col items-center justify-center gap-4 min-h-[70vh] text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
                {t("title")}
            </h2>
            <p className="max-w-md leading-relaxed text-ink-muted">
                {t("body")}
                <br />
                {t("hint")}
            </p>
            <SignOut />
        </div>
    )
}
