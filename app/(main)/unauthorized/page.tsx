'use client'
import { useSession, signIn } from "next-auth/react"
import { useTranslations } from "next-intl";
import { SignOut } from "@/components/AuthButtons";
import Button from "@/components/ui/Button";

export default function UnauthorizedPage() {
    const t = useTranslations("unauthorized");
    const tCommon = useTranslations("common");
    const { data: session, status } = useSession()

    if (status === "loading") {
        return <p className="p-6 text-ink-subtle">{t("loading")}</p>
    }

    if (status === "unauthenticated") {
        return <div className="p-6"><Button onClick={() => signIn("google")}>{tCommon("login")}</Button></div>
    }

    const isDeactivated = session?.user?.isActive === false;

    // A <div>: the (main) layout already renders the page's <main>
    return (
        <div className="flex items-center justify-center min-h-screen p-6">
            <div className="w-full max-w-sm flex flex-col items-center gap-6 rounded-3xl border border-line bg-card p-8 text-center">
                <h2 className="text-3xl font-semibold tracking-tight text-ink">
                    {t("title")}
                </h2>
                {isDeactivated ? (
                    <>
                        <p className="text-danger">
                            {t("deactivated")}
                        </p>
                        <SignOut />
                    </>
                ) : (
                    <Button onClick={() => { window.location.href = "/" }}>
                        {tCommon("backToHome")}
                    </Button>
                )}
            </div>
        </div>
    );
}
