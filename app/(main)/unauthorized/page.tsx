'use client'
import { useSession, signIn } from "next-auth/react"
import { useTranslations } from "next-intl";
import { SignOut } from "@/components/AuthButtons";

export default function UnauthorizedPage() {
    const t = useTranslations("unauthorized");
    const tCommon = useTranslations("common");
    const { data: session, status } = useSession()

    if (status === "loading") {
        return <p>{t("loading")}</p>
    }

    if (status === "unauthenticated") {
        return <button onClick={() => signIn("google")}>{tCommon("login")}</button>
    }

    const isDeactivated = session?.user?.isActive === false;

    return (
        <main className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
                <div className="w-full flex items-center justify-center flex-col max-w-sm p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
                    <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">
                        {t("title")}
                    </h2>
                    <br />
                    {isDeactivated ? (
                        <>
                            <p className="text-center text-red-500">
                                {t("deactivated")}
                            </p>
                            <SignOut />
                        </>
                    ) : (
                        <button className="bg-primary" onClick={() => { window.location.href = "/" }}>
                            {tCommon("backToHome")}
                        </button>
                    )}
                </div>
            </div>
        </main>
    );
}
