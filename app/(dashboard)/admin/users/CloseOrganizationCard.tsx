"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

/** "Danger zone" card for closing the organization. Only rendered for its owner or the superadmin. */
export default function CloseOrganizationCard({ organizationName }: { organizationName: string }) {
    const t = useTranslations("users.closeOrganization");
    const tErrors = useTranslations("errors");
    const [isOpen, setIsOpen] = useState(false);
    const [confirmName, setConfirmName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const close = () => {
        setIsOpen(false);
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
                body: JSON.stringify({ confirmName }),
            });
            if (!res.ok) {
                setError((await res.json()).error || tErrors("serverError"));
                setLoading(false);
                return;
            }
            // Full reload so the session is resolved again: next organization, or the lobby when there is none
            window.location.href = "/";
        } catch {
            setError(tErrors("connection"));
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-8 rounded-[2.5rem] border border-danger/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
                <p className="text-[10px] font-black text-danger uppercase tracking-[0.3em] mb-2">{t("title")}</p>
                <p className="text-sm text-brand/60 font-medium max-w-xl">{t("description")}</p>
            </div>
            <button
                onClick={() => setIsOpen(true)}
                className="shrink-0 px-6 py-3 border border-danger/30 text-danger rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-danger/5 transition-all"
            >
                {t("button")}
            </button>

            <Modal isOpen={isOpen} onClose={close} title={t("title")}
                footer={
                    <button
                        onClick={handleClose}
                        disabled={loading || confirmName.trim() !== organizationName.trim()}
                        className="w-full bg-danger text-white py-4 rounded-4xl font-black text-sm uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-40"
                    >
                        {loading ? t("closing") : t("confirm")}
                    </button>
                }
            >
                <div className="space-y-6">
                    <div className="flex gap-3 p-4 bg-danger/5 rounded-2xl text-danger">
                        <AlertTriangle size={20} className="shrink-0" />
                        <p className="text-sm font-medium">{t("warning", { name: organizationName })}</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-brand/60">{t("confirmLabel", { name: organizationName })}</label>
                        <input
                            value={confirmName}
                            onChange={(e) => setConfirmName(e.target.value)}
                            autoComplete="off"
                            className="w-full bg-surface border border-brand/5 rounded-2xl px-5 py-4 text-sm font-bold text-brand focus:ring-2 ring-danger/20 outline-none"
                        />
                    </div>
                    {error && <p className="text-sm font-bold text-danger">{error}</p>}
                </div>
            </Modal>
        </div>
    );
}
