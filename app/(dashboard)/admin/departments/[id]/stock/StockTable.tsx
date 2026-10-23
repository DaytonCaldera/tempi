"use client";
import { Plus, Minus, Edit, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/DataTable";
import type { MovementType } from "@/types/models";
import { labelOf } from "@/i18n/labels";
import type { StockRow } from "./useDepartmentStock";

interface StockTableProps {
    items: StockRow[];
    onQuickMove: (item: StockRow, type: MovementType) => void;
    onEdit: (item: StockRow) => void;
    onDelete: (item: StockRow) => void;
}

export function StockTable({ items, onQuickMove, onEdit, onDelete }: StockTableProps) {
    const t = useTranslations("stock.table");
    const tCommon = useTranslations("common");
    const tUnits = useTranslations("units");
    const headers = [{ title: t("product") }, { title: t("category") }, { title: t("quantity") }, { title: t("quickActions") }];

    return (
        <DataTable headers={headers}>
            {items.map(item => {
                const isLow = item.quantity <= item.minStock;
                return (
                    <DataTableRow key={item._id}>
                        <DataTableCell>
                            <div className="flex flex-col">
                                <span className="font-bold text-[#171717]">{item.productName}</span>
                                <span className="text-[10px] text-gray-400 font-mono tracking-tighter uppercase">{item.sku}</span>
                            </div>
                        </DataTableCell>

                        <DataTableCell>
                            <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-bold uppercase">
                                {item.category || tCommon("general")}
                            </span>
                        </DataTableCell>

                        <DataTableCell>
                            <div className="flex items-center gap-3">
                                <span className={`text-lg font-black ${isLow ? 'text-orange-500' : 'text-[#171717]'}`}>
                                    {item.quantity}
                                </span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{labelOf(tUnits, item.unit)}</span>
                                {isLow && <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />}
                            </div>
                        </DataTableCell>

                        <DataTableCell>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onQuickMove(item, "OUT")}
                                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 active:scale-90 transition-all"
                                >
                                    <Minus size={16} />
                                </button>
                                <button
                                    onClick={() => onQuickMove(item, "IN")}
                                    className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 active:scale-90 transition-all"
                                >
                                    <Plus size={16} />
                                </button>
                                <button
                                    onClick={() => onEdit(item)}
                                    className="p-2 bg-gray-100 text-gray-400 rounded-lg hover:bg-gray-100 active:scale-90 transition-all ml-2"
                                >
                                    <Edit size={16} className="text-gray-400 hover:text-[#0070f3] transition-colors " />
                                </button>
                                <button
                                    onClick={() => onDelete(item)}
                                    className="p-2 bg-gray-100 text-gray-400 rounded-lg hover:bg-red-50 active:scale-90 transition-all"
                                >
                                    <Trash2 size={16} className="text-gray-400 hover:text-red-600 transition-colors" />
                                </button>
                            </div>
                        </DataTableCell>
                    </DataTableRow>
                );
            })}
        </DataTable>
    );
}
