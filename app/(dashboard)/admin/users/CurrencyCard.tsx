"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Coins } from "lucide-react";
import { CURRENCIES, type Currency } from "@/lib/currency";

/** The currency the organization's costs are in. Saved with PATCH /api/admin/organization/currency. */
export default function CurrencyCard({ initial }: { initial: Currency }) {
    const t = useTranslations("users.currency");
    const tCommon = useTranslations("common");
    const tErrors = useTranslations("errors");
    const locale = useLocale();
    const [saved, setSaved] = useState(initial);
    const [currency, setCurrency] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

    // "Costa Rican Colón (CRC)", in the viewer's language
    const names = new Intl.DisplayNames([locale], { type: "currency" });

    const save = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/organization/currency", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currency }),
            }).catch(() => null);
            const data = await res?.json().catch(() => null);
            if (!res?.ok) {
                setMessage({ kind: "error", text: data?.error || tErrors("connection") });
                return;
            }
            setSaved(data.currency);
            setMessage({ kind: "ok", text: t("saved") });
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="bg-card p-8 rounded-3xl border border-line space-y-6">
            <div className="flex items-start gap-4">
                <Coins size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                <div>
                    <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-[0.2em] mb-2">{t("title")}</p>
                    <p className="text-sm text-ink-muted font-medium max-w-xl">{t("description")}</p>
                </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <label htmlFor="org-currency" className="sr-only">{t("title")}</label>
                <select
                    id="org-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Currency)}
                    className="w-full sm:w-80 bg-subtle border border-line rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-accent"
                >
                    {CURRENCIES.map(code => <option key={code} value={code}>{names.of(code)} ({code})</option>)}
                </select>
                <button
                    onClick={save}
                    disabled={saving || currency === saved}
                    className="px-6 py-3 bg-inverse text-on-inverse rounded-2xl text-xs font-semibold uppercase tracking-widest hover:bg-accent hover:text-on-accent transition-all disabled:opacity-40"
                >
                    {saving ? tCommon("saving") : tCommon("saveChanges")}
                </button>
                {message && <p role="status" className={`text-sm font-semibold ${message.kind === "ok" ? "text-success" : "text-danger"}`}>{message.text}</p>}
            </div>
        </section>
    );
}
