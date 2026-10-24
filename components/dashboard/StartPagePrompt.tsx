"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Boxes } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { StartPage } from "@/types/models";

/**
 * Asks a runner (a user with assigned areas) whether to start on the runner page after signing in.
 * Shown on the dashboard until they answer; closing it counts as "no". Changed later from the account page.
 */
export default function StartPagePrompt() {
    const t = useTranslations("startPage");
    const tErrors = useTranslations("errors");
    const router = useRouter();
    const { update } = useSession();
    const [isOpen, setIsOpen] = useState(true);
    const [saving, setSaving] = useState<StartPage | null>(null);
    const [error, setError] = useState("");

    const choose = async (startPage: StartPage) => {
        setSaving(startPage);
        setError("");
        try {
            const res = await fetch("/api/user/start-page", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ startPage }),
            });
            if (!res.ok) throw new Error();
            // Re-reads the user, so the session (and the next visit to "/") sees the choice
            await update();
            if (startPage === "runner") {
                router.push("/runner");
            } else {
                setIsOpen(false);
                router.refresh();
            }
        } catch {
            setError(tErrors("connection"));
            setSaving(null);
        }
    };

    const button = "flex-1 py-4 rounded-3xl font-semibold text-sm uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40";

    return (
        <Modal isOpen={isOpen} onClose={() => !saving && choose("dashboard")} title={t("title")}
            footer={
                <div className="flex gap-3">
                    <button onClick={() => choose("dashboard")} disabled={!!saving} className={`${button} border border-line text-ink hover:border-line-strong`}>
                        {saving === "dashboard" ? t("saving") : t("no")}
                    </button>
                    <button onClick={() => choose("runner")} disabled={!!saving} className={`${button} bg-accent text-on-accent hover:brightness-110`}>
                        {saving === "runner" ? t("saving") : t("yes")}
                    </button>
                </div>
            }
        >
            <div className="space-y-4">
                <div className="flex gap-3 p-4 bg-accent/5 rounded-2xl text-ink">
                    <Boxes size={20} className="shrink-0 text-accent" />
                    <p className="text-sm font-medium">{t("description")}</p>
                </div>
                <p className="text-xs text-ink-subtle">{t("hint")}</p>
                {error && <p className="text-sm font-bold text-danger">{error}</p>}
            </div>
        </Modal>
    );
}
