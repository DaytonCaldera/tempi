"use client";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangle, Check, X } from "lucide-react";
import { labelOf } from "@/i18n/labels";
import type { HeldView } from "@/lib/offline-sync-server";

interface HeldListProps {
    held: HeldView[];
    /** Called after a move was applied or discarded */
    onResolved: () => void;
    /** Show who made each move (the admins' view) */
    showRunner?: boolean;
}

/**
 * Moves made without connection that weren't applied when they synced (lib/offline-sync.ts), each with why and
 * the two decisions: apply it now, or discard it. Used by the runner (their own) and the dashboard (admins).
 */
export default function HeldList({ held, onResolved, showRunner = false }: HeldListProps) {
    const t = useTranslations("held");
    const tUnits = useTranslations("units");
    const tErrors = useTranslations("errors");
    const format = useFormatter();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const time = (iso: string) => format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });

    const decide = async (move: HeldView, decision: "apply" | "discard") => {
        setBusyId(move._id);
        setErrors(current => ({ ...current, [move._id]: "" }));
        try {
            const res = await fetch(`/api/runner/held/${move._id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ decision }),
            }).catch(() => null);
            const data = await res?.json().catch(() => null);
            if (!res?.ok) {
                setErrors(current => ({ ...current, [move._id]: data?.error || tErrors("connection") }));
                return;
            }
            onResolved();
        } finally {
            setBusyId(null);
        }
    };

    if (held.length === 0) return <p className="text-sm text-ink-muted">{t("empty")}</p>;

    return (
        <ul className="space-y-3">
            {held.map(move => {
                const amount = `${move.type === "OUT" ? "−" : "+"}${move.amount} ${labelOf(tUnits, move.unit).toLowerCase()}`;
                return (
                    <li key={move._id} className="rounded-2xl border border-warning/30 bg-warning/5 p-4">
                        <p className="flex items-start gap-2 text-sm font-bold text-ink">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden />
                            <span>{amount} · {move.productName} <span className="font-normal text-ink-subtle">({move.departmentName})</span></span>
                        </p>
                        <p className="mt-1 text-xs text-ink-muted">
                            {showRunner
                                ? t("madeBy", { name: move.user.name || move.user.email || "", time: time(move.occurredAt) })
                                : t("madeAt", { time: time(move.occurredAt) })}
                        </p>
                        <p className="mt-2 text-sm text-ink">
                            {move.holdReason === "possibleDuplicate" && move.duplicateOf
                                ? t("reasons.possibleDuplicate", { name: move.duplicateOf.userName || "", amount: move.duplicateOf.amount, time: time(move.duplicateOf.createdAt) })
                                : t(`reasons.${move.holdReason === "possibleDuplicate" ? "possibleDuplicateUnknown" : move.holdReason}`)}
                        </p>
                        {errors[move._id] && <p role="alert" className="mt-2 text-xs font-semibold text-danger">{errors[move._id]}</p>}
                        <div className="mt-3 flex gap-2">
                            <button
                                onClick={() => decide(move, "discard")}
                                disabled={busyId === move._id}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-card py-2.5 text-xs font-black uppercase tracking-wider text-ink-muted active:scale-95 disabled:opacity-40"
                            >
                                <X size={14} aria-hidden /> {t("discard")}
                            </button>
                            <button
                                onClick={() => decide(move, "apply")}
                                disabled={busyId === move._id}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-inverse py-2.5 text-xs font-black uppercase tracking-wider text-on-inverse active:scale-95 disabled:opacity-40"
                            >
                                <Check size={14} aria-hidden /> {t("apply")}
                            </button>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
