"use client";
import { Plus, Minus, Edit, Trash2, ArrowLeftRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/DataTable";
import type { MovementType } from "@/types/models";
import { labelOf } from "@/i18n/labels";
import type { StockRow } from "./useDepartmentStock";

interface StockTableProps {
    items: StockRow[];
    onQuickMove: (item: StockRow, type: MovementType) => void;
    onEdit: (item: StockRow) => void;
    onDelete: (item: StockRow) => void;
    /** The organization's currency, for each product's cost and value */
    currency: string;
    /** Missing when the organization has no other department to transfer to */
    onTransfer?: (item: StockRow) => void;
}

export function StockTable({ items, onQuickMove, onEdit, onDelete, onTransfer, currency }: StockTableProps) {
    const t = useTranslations("stock.table");
    const tCommon = useTranslations("common");
    const tUnits = useTranslations("units");
    const format = useFormatter();
    const money = (value: number) => format.number(value, { style: "currency", currency, currencyDisplay: "narrowSymbol" });
    const headers = [{ title: t("product") }, { title: t("category") }, { title: t("quantity") }, { title: t("quickActions") }];

    return (
        <DataTable headers={headers}>
            {items.map(item => {
                const isLow = item.quantity <= item.minStock;
                return (
                    <DataTableRow key={item._id}>
                        <DataTableCell>
                            <div className="flex flex-col">
                                <span className="font-bold text-ink">{item.productName}</span>
                                <span className="text-[10px] text-ink-subtle font-mono tracking-tight uppercase">{item.sku}</span>
                            </div>
                        </DataTableCell>

                        <DataTableCell>
                            <span className="px-2 py-1 bg-subtle text-ink-muted rounded-lg text-[10px] font-bold uppercase">
                                {item.category || tCommon("general")}
                            </span>
                        </DataTableCell>

                        <DataTableCell>
                            <div className="flex items-center gap-3">
                                <span className={`text-lg font-semibold ${isLow ? 'text-warning' : 'text-ink'}`}>
                                    {item.quantity}
                                </span>
                                <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-tight">{labelOf(tUnits, item.unit)}</span>
                                {isLow && <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />}
                            </div>
                            {item.unitCost !== undefined && (
                                <p className="text-[11px] text-ink-subtle tabular-nums">
                                    {t("costLine", { cost: money(item.unitCost), value: money(item.quantity * item.unitCost) })}
                                </p>
                            )}
                        </DataTableCell>

                        <DataTableCell>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onQuickMove(item, "OUT")}
                                    aria-label={t("actions.remove", { product: item.productName })}
                                    title={t("actions.remove", { product: item.productName })}
                                    className="p-2 bg-danger/10 text-danger rounded-lg hover:bg-danger/15 active:scale-90 transition-all"
                                >
                                    <Minus size={16} />
                                </button>
                                <button
                                    onClick={() => onQuickMove(item, "IN")}
                                    aria-label={t("actions.add", { product: item.productName })}
                                    title={t("actions.add", { product: item.productName })}
                                    className="p-2 bg-success/10 text-success rounded-lg hover:bg-success/15 active:scale-90 transition-all"
                                >
                                    <Plus size={16} />
                                </button>
                                {onTransfer && (
                                    <button
                                        onClick={() => onTransfer(item)}
                                        aria-label={t("actions.transfer", { product: item.productName })}
                                        title={t("actions.transfer", { product: item.productName })}
                                        className="p-2 bg-subtle text-ink-subtle rounded-lg hover:text-accent active:scale-90 transition-all ml-2"
                                    >
                                        <ArrowLeftRight size={16} />
                                    </button>
                                )}
                                <button
                                    onClick={() => onEdit(item)}
                                    aria-label={t("actions.edit", { product: item.productName })}
                                    title={t("actions.edit", { product: item.productName })}
                                    className="p-2 bg-subtle text-ink-subtle rounded-lg hover:bg-subtle active:scale-90 transition-all ml-2"
                                >
                                    <Edit size={16} className="text-ink-subtle hover:text-accent transition-colors " />
                                </button>
                                <button
                                    onClick={() => onDelete(item)}
                                    aria-label={t("actions.delete", { product: item.productName })}
                                    title={t("actions.delete", { product: item.productName })}
                                    className="p-2 bg-subtle text-ink-subtle rounded-lg hover:bg-danger/10 active:scale-90 transition-all"
                                >
                                    <Trash2 size={16} className="text-ink-subtle hover:text-danger transition-colors" />
                                </button>
                            </div>
                        </DataTableCell>
                    </DataTableRow>
                );
            })}
        </DataTable>
    );
}
