"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Package, Hash, Ruler, RefreshCw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { usePlanLimitDialog } from "@/components/admin/PlanLimitDialog";
import { STOCK_UNITS } from "@/lib/constants";
import type { StockRow } from "./useDepartmentStock";

export type StockItemForm = { name: string; sku: string; unit: string; quantity: number; minStock: number };

/** Random SKU with the department prefix, e.g. "LOG-4832". */
export const generateSKU = (departmentName: string) => {
    const prefix = departmentName.substring(0, 3).toUpperCase().replace(/\s/g, 'X');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${randomNum}`;
};

interface StockItemModalProps {
    isOpen: boolean;
    /** The item to edit, or null to create a new one */
    editingItem: StockRow | null;
    departmentId: string;
    departmentName: string;
    onClose: () => void;
    onSaved: () => void;
}

/**
 * Create/edit form for a product. Quantity is only set on creation, later it changes through stock moves.
 * The parent gives it a new `key` each time it opens, so the form starts from the item's current values.
 */
export function StockItemModal({ isOpen, editingItem, departmentId, departmentName, onClose, onSaved }: StockItemModalProps) {
    const t = useTranslations("stock.form");
    const tCommon = useTranslations("common");
    const tErrors = useTranslations("errors");
    const tUnits = useTranslations("units");
    const isEditing = !!editingItem;
    const [isSaving, setIsSaving] = useState(false);
    const { handlePlanError, planDialog } = usePlanLimitDialog();
    const [formData, setFormData] = useState<StockItemForm>(() => editingItem
        ? { name: editingItem.productName, sku: editingItem.sku, unit: editingItem.unit, quantity: editingItem.quantity, minStock: editingItem.minStock }
        : { name: "", sku: generateSKU(departmentName), unit: STOCK_UNITS[0], quantity: 0, minStock: 5 });

    const update = (changes: Partial<StockItemForm>) => setFormData({ ...formData, ...changes });

    const handleSave = async () => {
        if (!formData.name || !formData.sku) {
            alert(tErrors("nameAndSkuRequired"));
            return;
        }

        setIsSaving(true);
        try {
            const { quantity, ...descriptiveFields } = formData;
            const res = await fetch(
                isEditing
                    ? `/api/admin/departments/${departmentId}/stock/${editingItem._id}`
                    : `/api/admin/departments/${departmentId}/stock`,
                {
                    method: isEditing ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(isEditing ? descriptiveFields : { ...descriptiveFields, quantity })
                }
            );
            if (res.ok) onSaved();
            else {
                const data = await res.json().catch(() => ({}));
                if (!handlePlanError(data)) alert(data.error || tErrors("saveFailed"));
            }
        } catch (error) {
            console.error("Error saving stock:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? t("editTitle") : t("newTitle")}>
            <div className="space-y-5">
                {/* PRODUCT NAME */}
                <div>
                    <label className="text-[10px] font-bold text-ink-subtle uppercase mb-1.5 block ml-1">{t("nameLabel")}</label>
                    <div className="relative">
                        <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle" size={16} />
                        <input
                            type="text"
                            className="w-full bg-subtle border border-line rounded-xl py-3 pl-12 pr-4 text-sm outline-none focus:border-accent transition-all"
                            placeholder={t("namePlaceholder")}
                            value={formData.name}
                            onChange={(e) => update({ name: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* SKU */}
                    <div>
                        <label className="text-[10px] font-bold text-ink-subtle uppercase mb-1.5 block ml-1">
                            {isEditing ? t("sku") : t("generatedSku")}
                        </label>
                        <div className="relative flex items-center">
                            <Hash className="absolute left-4 text-ink-subtle" size={16} />
                            <input
                                type="text"
                                readOnly // Keeps the generated format
                                className="w-full bg-subtle border border-line rounded-xl py-3 pl-12 pr-12 text-sm font-mono font-bold text-accent outline-none"
                                value={formData.sku}
                            />
                            {!isEditing && (
                                <button
                                    type="button"
                                    onClick={() => update({ sku: generateSKU(departmentName) })}
                                    className="absolute right-3 p-1.5 text-ink-subtle hover:text-accent transition-colors"
                                    title={t("regenerateSku")}
                                >
                                    <RefreshCw size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* UNIT */}
                    <div>
                        <label className="text-[10px] font-bold text-ink-subtle uppercase mb-1.5 block ml-1">{t("unit")}</label>
                        <div className="relative">
                            <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle" size={16} />
                            <select
                                className="w-full bg-subtle border border-line rounded-xl py-3 pl-12 pr-4 text-sm outline-none focus:border-accent appearance-none"
                                value={formData.unit}
                                onChange={(e) => update({ unit: e.target.value })}
                            >
                                {STOCK_UNITS.map(unit => (
                                    <option key={unit} value={unit}>{tUnits(unit)}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <hr className="border-line my-2" />

                <div className="grid grid-cols-2 gap-4">
                    {/* QUANTITY: editable only on creation */}
                    <div className="bg-accent/10 p-4 rounded-2xl border border-accent/20">
                        <label className="text-[10px] font-semibold text-accent uppercase mb-1 block">
                            {isEditing ? t("currentQuantity") : t("initialStock")}
                        </label>
                        <input
                            type="number"
                            readOnly={isEditing}
                            className={`w-full bg-transparent text-2xl font-semibold text-ink outline-none ${isEditing ? "opacity-60 text-ink-subtle cursor-not-allowed" : ""}`}
                            value={formData.quantity}
                            onChange={(e) => !isEditing && update({ quantity: Number(e.target.value) })}
                        />
                    </div>

                    {/* MIN STOCK */}
                    <div className="bg-warning/10 p-4 rounded-2xl border border-warning/20">
                        <label className="text-[10px] font-semibold text-warning uppercase mb-1 block">{t("minStock")}</label>
                        <input
                            type="number"
                            className="w-full bg-transparent text-2xl font-semibold text-ink outline-none"
                            value={formData.minStock}
                            onChange={(e) => update({ minStock: Number(e.target.value) })}
                        />
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full bg-inverse text-on-inverse py-4 rounded-2xl font-semibold hover:bg-accent hover:text-on-accent transition-all flex items-center justify-center gap-2 mt-4"
                >
                    {isSaving ? tCommon("saving") : isEditing ? tCommon("saveChanges") : t("register")}
                </button>
            </div>
            {planDialog}
        </Modal>
    );
}
