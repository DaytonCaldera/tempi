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
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
                {t("title")}
            </h2>
            <p className="text-gray-400">
                {t("body")}
                <br />
                {t("hint")}
            </p>
            <SignOut />
        </div>
    )
}
