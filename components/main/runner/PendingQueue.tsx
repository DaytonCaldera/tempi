"use client";
import { useFormatter, useTranslations } from "next-intl";
import { CloudOff, Send, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { labelOf } from "@/i18n/labels";
import type { PendingMove } from "@/lib/offline-queue";

interface PendingQueueProps {
    open: boolean;
    queue: PendingMove[];
    isOnline: boolean;
    isSending: boolean;
    onCancel: (offlineId: string) => void;
    onSend: () => void;
    onClose: () => void;
}

/**
 * The moves made without connection that wait to be sent, with when each was made. Cancelling one is the way to
 * go when a connected colleague recorded it instead: it never reaches the server.
 */
export default function PendingQueue({ open, queue, isOnline, isSending, onCancel, onSend, onClose }: PendingQueueProps) {
    const t = useTranslations("runner.queue");
    const tUnits = useTranslations("units");
    const format = useFormatter();

    return (
        <Modal isOpen={open} onClose={onClose} title={t("title", { count: queue.length })}>
            <div className="space-y-4">
                <p className="flex items-start gap-2 text-sm text-ink-muted">
                    <CloudOff size={16} className="mt-0.5 shrink-0" aria-hidden />
                    {isOnline ? t("introOnline") : t("introOffline")}
                </p>

                {queue.length === 0 ? (
                    <p className="text-sm font-semibold text-ink-subtle">{t("empty")}</p>
                ) : (
                    <ul className="divide-y divide-line">
                        {queue.map(move => (
                            <li key={move.offlineId} className="flex items-center gap-3 py-3">
                                <span className={`w-14 shrink-0 text-lg font-black tabular-nums ${move.type === "OUT" ? "text-danger" : "text-success"}`}>
                                    {move.type === "OUT" ? "−" : "+"}{move.amount}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-bold text-ink">{move.productName}</span>
                                    <span className="block text-xs text-ink-subtle">
                                        {labelOf(tUnits, move.unit)} · {format.dateTime(new Date(move.occurredAt), { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </span>
                                <button
                                    onClick={() => onCancel(move.offlineId)}
                                    disabled={isSending}
                                    aria-label={t("cancel", { product: move.productName })}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-subtle hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                {queue.length > 0 && (
                    <button
                        onClick={onSend}
                        disabled={!isOnline || isSending}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-inverse py-4 font-semibold text-on-inverse transition-all hover:bg-accent hover:text-on-accent disabled:opacity-40"
                    >
                        <Send size={16} aria-hidden /> {isSending ? t("sendingNow") : isOnline ? t("sendNow") : t("waiting")}
                    </button>
                )}
            </div>
        </Modal>
    );
}
