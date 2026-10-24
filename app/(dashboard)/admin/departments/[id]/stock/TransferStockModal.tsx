"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { usePlanLimitDialog } from "@/components/admin/PlanLimitDialog";
import { labelOf } from "@/i18n/labels";
import type { TransferPreview } from "@/types/models";
import type { StockRow } from "./useDepartmentStock";

interface TransferStockModalProps {
    /** The product to transfer, or null when closed */
    item: StockRow | null;
    /** The organization's other departments */
    departments: { _id: string; name: string }[];
    onClose: () => void;
    onTransferred: () => void;
}

/** How long the preview waits for the amount to stop changing before asking the server. */
const PREVIEW_DELAY_MS = 300;

/**
 * Moves stock of a product to another department in one step (POST /api/admin/inventory/[id]/transfer).
 * Shows what will happen there before confirming: which product it adds to, or that it will be created.
 * The parent gives it a new `key` each time it opens.
 */
export function TransferStockModal({ item, departments, onClose, onTransferred }: TransferStockModalProps) {
    const t = useTranslations("stock.transfer");
    const tErrors = useTranslations("errors");
    const tUnits = useTranslations("units");
    const { handlePlanError, planDialog } = usePlanLimitDialog();
    const [toDepartmentId, setToDepartmentId] = useState(departments[0]?._id ?? "");
    const [amount, setAmount] = useState(1);
    const [preview, setPreview] = useState<TransferPreview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const send = async (dryRun: boolean) => {
        const res = await fetch(`/api/admin/inventory/${item!._id}/transfer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toDepartmentId, amount, dryRun }),
        }).catch(() => null);
        const data = await res?.json().catch(() => null);
        if (!res?.ok) {
            if (!handlePlanError(data ?? {})) setError(data?.error || tErrors("connection"));
            return null;
        }
        return data;
    };

    // The preview follows the chosen department and amount
    useEffect(() => {
        if (!item || !toDepartmentId || !(amount > 0)) return;
        let cancelled = false;
        const timer = setTimeout(async () => {
            setError(null);
            const data = await send(true);
            if (!cancelled) setPreview(data);
        }, PREVIEW_DELAY_MS);
        return () => { cancelled = true; clearTimeout(timer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- send only reads the values listed
    }, [item, toDepartmentId, amount]);

    const confirm = async () => {
        setBusy(true);
        setError(null);
        try {
            if (await send(false)) onTransferred();
        } finally {
            setBusy(false);
        }
    };

    if (!item) return null;
    const unit = labelOf(tUnits, item.unit).toLowerCase();
    const tooMuch = amount > item.quantity;

    return (
        <Modal isOpen onClose={onClose} title={t("title")}>
            <div className="space-y-5">
                <p className="text-sm text-ink-muted">
                    {t.rich("intro", { product: item.productName, quantity: item.quantity, unit, b: (chunks) => <span className="font-bold text-ink">{chunks}</span> })}
                </p>

                <div>
                    <label htmlFor="transfer-department" className="text-[10px] font-bold text-ink-subtle uppercase mb-1.5 block ml-1">{t("toLabel")}</label>
                    <select
                        id="transfer-department"
                        value={toDepartmentId}
                        onChange={(e) => { setToDepartmentId(e.target.value); setPreview(null); }}
                        className="w-full bg-subtle border border-line rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-accent"
                    >
                        {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                </div>

                <div>
                    <label htmlFor="transfer-amount" className="text-[10px] font-bold text-ink-subtle uppercase mb-1.5 block ml-1">{t("amountLabel", { unit })}</label>
                    <input
                        id="transfer-amount"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={amount || ""}
                        onChange={(e) => { setAmount(Number(e.target.value)); setPreview(null); }}
                        className="w-full bg-subtle border border-line rounded-xl px-4 py-3 text-2xl font-semibold text-ink outline-none focus:border-accent"
                    />
                    {tooMuch && <p className="mt-1 ml-1 text-xs font-semibold text-warning">{t("tooMuch", { quantity: item.quantity, unit })}</p>}
                </div>

                {preview && !error && (
                    <div className="flex items-start gap-3 rounded-2xl bg-accent/10 p-4 text-sm text-ink">
                        <ArrowRight size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                        <p>
                            {preview.target
                                ? t("previewExisting", {
                                    department: preview.targetDepartmentName, product: preview.target.productName, sku: preview.target.sku,
                                    before: preview.target.quantity, after: preview.target.quantity + amount, unit,
                                })
                                : t("previewNew", { department: preview.targetDepartmentName, amount, unit })}
                        </p>
                    </div>
                )}

                {error && (
                    <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
                    </p>
                )}

                <button
                    onClick={confirm}
                    disabled={busy || !preview || !!error || tooMuch || !(amount > 0)}
                    className="w-full bg-inverse text-on-inverse py-4 rounded-2xl font-semibold hover:bg-accent hover:text-on-accent transition-all disabled:opacity-40 disabled:hover:bg-inverse disabled:hover:text-on-inverse"
                >
                    {busy ? t("transferring") : t("confirm")}
                </button>
            </div>
            {planDialog}
        </Modal>
    );
}
