"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { AlertTriangle, UserX } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

/**
 * "Danger zone" card for closing the organization. Only rendered for its owner or the superadmin.
 * When it is the user's last organization, a second step makes them confirm they'll be left without one.
 */
export default function CloseOrganizationCard({ organizationName, isLastOrganization }: { organizationName: string; isLastOrganization: boolean }) {
    const t = useTranslations("users.closeOrganization");
    const tCommon = useTranslations("common");
    const tErrors = useTranslations("errors");
    const { update } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<"name" | "lastOrganization">("name");
    const [confirmName, setConfirmName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const close = () => {
        setIsOpen(false);
        setStep("name");
        setConfirmName("");
        setError("");
    };

    const handleClose = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/admin/organization/close", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ confirmName, acknowledgeLastOrganization: step === "lastOrganization" }),
            });
            if (!res.ok) {
                setError((await res.json()).error || tErrors("serverError"));
                setLoading(false);
                return;
            }
            const { nextClientId } = await res.json() as { nextClientId: string | null };
            // Re-resolve the session now (a fresh read), so no cached copy brings the closed organization back
            await update({ clientId: nextClientId ?? "none" });
            // Full reload so every component reads the new session
            window.location.href = nextClientId ? "/" : "/account?closed=1";
        } catch {
            setError(tErrors("connection"));
            setLoading(false);
        }
    };

    const nameMatches = confirmName.trim() === organizationName.trim();
    const dangerButton = "w-full bg-danger text-canvas py-4 rounded-3xl font-semibold text-sm uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-40";

    const footer = step === "name" ? (
        <button
            onClick={isLastOrganization ? () => setStep("lastOrganization") : handleClose}
            disabled={loading || !nameMatches}
            className={dangerButton}
        >
            {loading ? t("closing") : isLastOrganization ? t("continue") : t("confirm")}
        </button>
    ) : (
        <div className="flex flex-col gap-3">
            <button onClick={handleClose} disabled={loading} className={dangerButton}>
                {loading ? t("closing") : t("confirmLast")}
            </button>
            <button
                onClick={() => setStep("name")}
                disabled={loading}
                className="w-full py-3 rounded-3xl text-sm font-semibold text-ink-muted hover:bg-subtle transition-all"
            >
                {tCommon("back")}
            </button>
        </div>
    );

    return (
        <div className="bg-card p-8 rounded-3xl border border-danger/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
                <p className="text-[10px] font-semibold text-danger uppercase tracking-[0.2em] mb-2">{t("title")}</p>
                <p className="text-sm text-ink-muted font-medium max-w-xl">{t("description")}</p>
            </div>
            <button
                onClick={() => setIsOpen(true)}
                className="shrink-0 px-6 py-3 border border-danger/30 text-danger rounded-2xl text-xs font-semibold uppercase tracking-widest hover:bg-danger/5 transition-all"
            >
                {t("button")}
            </button>

            <Modal isOpen={isOpen} onClose={close} title={t("title")} footer={footer}>
                {step === "name" ? (
                    <div className="space-y-6">
                        <div className="flex gap-3 p-4 bg-danger/5 rounded-2xl text-danger">
                            <AlertTriangle size={20} className="shrink-0" />
                            <p className="text-sm font-medium">{t("warning", { name: organizationName })}</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-ink-muted">{t("confirmLabel", { name: organizationName })}</label>
                            <input
                                value={confirmName}
                                onChange={(e) => setConfirmName(e.target.value)}
                                autoComplete="off"
                                className="w-full bg-subtle border border-line rounded-2xl px-5 py-4 text-sm font-bold text-ink focus:ring-2 ring-danger/20 outline-none"
                            />
                        </div>
                        {error && <p className="text-sm font-bold text-danger">{error}</p>}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex gap-3 p-4 bg-danger/5 rounded-2xl text-danger">
                            <UserX size={20} className="shrink-0" />
                            <p className="text-sm font-semibold">{t("lastTitle")}</p>
                        </div>
                        <p className="text-sm text-ink-muted font-medium">{t("lastDescription", { name: organizationName })}</p>
                        {error && <p className="text-sm font-bold text-danger">{error}</p>}
                    </div>
                )}
            </Modal>
        </div>
    );
}
