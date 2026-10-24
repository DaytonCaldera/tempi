"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import type { StockRow } from "./useDepartmentStock";

interface DeleteStockItemModalProps {
    item: StockRow | null;
    onCancel: () => void;
    onConfirm: (item: StockRow) => Promise<void>;
}

export function DeleteStockItemModal({ item, onCancel, onConfirm }: DeleteStockItemModalProps) {
    const t = useTranslations("stock.delete");
    const tCommon = useTranslations("common");
    const [isDeleting, setIsDeleting] = useState(false);

    const handleConfirm = async () => {
        if (!item) return;
        setIsDeleting(true);
        try {
            await onConfirm(item);
        } catch (error) {
            console.error("Error deleting stock item:", error);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Modal isOpen={!!item} onClose={onCancel} title={t("title")}>
            <div className="space-y-5">
                <p className="text-sm text-ink-muted">
                    {t.rich("confirm", {
                        name: item?.productName ?? "",
                        sku: item?.sku ?? "",
                        b: (chunks) => <span className="font-bold text-ink">{chunks}</span>,
                    })}
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 bg-card border border-line text-ink-muted py-3 rounded-2xl font-semibold hover:bg-subtle transition-all"
                    >
                        {tCommon("cancel")}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isDeleting}
                        className="flex-1 bg-danger text-canvas py-3 rounded-2xl font-semibold hover:brightness-110 transition-all"
                    >
                        {isDeleting ? tCommon("deleting") : tCommon("delete")}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
