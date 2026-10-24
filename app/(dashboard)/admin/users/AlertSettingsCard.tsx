"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { BellRing, X } from "lucide-react";
import type { AlertSettings } from "@/lib/stock-alerts";

const MAX_EXTRA_EMAILS = 5; // Same as lib/stock-alerts.ts (server only)

/**
 * The organization's email alerts: the low stock email to the admins, and extra addresses that get it too
 * (e.g. whoever does the purchasing). Saved with PATCH /api/admin/organization/alerts.
 */
export default function AlertSettingsCard({ initial, emailAvailable }: { initial: AlertSettings; emailAvailable: boolean }) {
    const t = useTranslations("users.alerts");
    const tCommon = useTranslations("common");
    const tErrors = useTranslations("errors");
    const [saved, setSaved] = useState(initial);
    const [enabled, setEnabled] = useState(initial.lowStockEmail);
    const [emails, setEmails] = useState(initial.extraEmails);
    const [draft, setDraft] = useState("");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

    const dirty = enabled !== saved.lowStockEmail || emails.join() !== saved.extraEmails.join() || draft.trim() !== "";

    const addDraft = () => {
        const email = draft.trim().toLowerCase();
        if (!email) return emails;
        const next = emails.includes(email) ? emails : [...emails, email];
        setEmails(next);
        setDraft("");
        return next;
    };

    const save = async () => {
        const extraEmails = addDraft();
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/organization/alerts", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lowStockEmail: enabled, extraEmails }),
            }).catch(() => null);
            const data = await res?.json().catch(() => null);
            if (!res?.ok) {
                setMessage({ kind: "error", text: data?.error || tErrors("connection") });
                return;
            }
            setSaved(data);
            setEmails(data.extraEmails);
            setMessage({ kind: "ok", text: t("saved") });
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="bg-card p-8 rounded-3xl border border-line space-y-6">
            <div className="flex items-start gap-4">
                <BellRing size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                <div>
                    <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-[0.2em] mb-2">{t("title")}</p>
                    <p className="text-sm text-ink-muted font-medium max-w-xl">{t("description")}</p>
                    {!emailAvailable && <p className="mt-2 text-xs font-semibold text-warning">{t("notConfigured")}</p>}
                </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-line px-5 py-4">
                <span>
                    <span className="block text-sm font-semibold text-ink">{t("lowStockLabel")}</span>
                    <span className="block text-xs text-ink-muted">{t("lowStockDescription")}</span>
                </span>
                <input type="checkbox" className="h-5 w-5 shrink-0 accent-accent" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            </label>

            <div className={enabled ? "" : "opacity-50"}>
                <label htmlFor="alert-email" className="text-[10px] font-bold text-ink-subtle uppercase mb-1.5 block ml-1">{t("extraLabel", { max: MAX_EXTRA_EMAILS })}</label>
                {emails.length > 0 && (
                    <ul className="mb-3 flex flex-wrap gap-2">
                        {emails.map(email => (
                            <li key={email} className="flex items-center gap-1 rounded-full bg-subtle py-1 pl-3 pr-1 text-xs font-semibold text-ink">
                                {email}
                                <button type="button" onClick={() => setEmails(emails.filter(e => e !== email))} className="rounded-full p-1 text-ink-subtle hover:text-ink" aria-label={t("remove", { email })}>
                                    <X size={12} aria-hidden />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {emails.length < MAX_EXTRA_EMAILS && (
                    <input
                        id="alert-email"
                        type="email"
                        value={draft}
                        disabled={!enabled}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDraft(); } }}
                        placeholder={t("extraPlaceholder")}
                        className="w-full bg-subtle border border-line rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-accent"
                    />
                )}
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={save}
                    disabled={saving || !dirty}
                    className="px-6 py-3 bg-inverse text-on-inverse rounded-2xl text-xs font-semibold uppercase tracking-widest hover:bg-accent hover:text-on-accent transition-all disabled:opacity-40"
                >
                    {saving ? tCommon("saving") : tCommon("saveChanges")}
                </button>
                {message && <p role="status" className={`text-sm font-semibold ${message.kind === "ok" ? "text-success" : "text-danger"}`}>{message.text}</p>}
            </div>
        </section>
    );
}
