"use client";
import { memo, useId } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { labelOf } from "@/i18n/labels";
import type { MovementType, StockItem } from "@/types/models";

interface StockRowProps {
    item: StockItem<string>;
    /** The quantity the −/+ buttons move. */
    quantity: number;
    isPending: boolean;
    /** Must be stable (rows are memoized): the parent passes one callback for every row. */
    onMove: (item: StockItem<string>, type: MovementType) => void;
}

/**
 * One product: name, SKU and stock, with buttons to take out or put in `quantity`.
 * Memoized, so a move, a toast or another row's spinner only re-renders the rows that changed.
 */
function StockRow({ item, quantity, isPending, onMove }: StockRowProps) {
    const t = useTranslations('runner');
    const tUnits = useTranslations('units');

    const hintId = useId();
    const isLow = item.quantity <= (item.minStock || 0);
    const notEnough = item.quantity < quantity;
    const cannotMove = isPending || quantity < 1;

    const buttonClass = "w-14 h-14 shrink-0 flex items-center justify-center gap-0.5 rounded-2xl active:scale-95 transition-all disabled:opacity-25";

    return (
        <div className="flex items-center gap-3 bg-white p-2.5 pl-4 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-foreground leading-tight line-clamp-2">{item.productName}</h3>
                <p className="text-[11px] font-bold text-blue-500 uppercase tracking-tight truncate">{item.sku}</p>
                {notEnough && (
                    <p id={hintId} className="text-[11px] font-bold text-amber-600 mt-0.5">
                        {item.quantity === 0 ? t('outOfStock') : t('onlyLeft', { count: item.quantity })}
                    </p>
                )}
            </div>

            <div className="text-right shrink-0">
                <p className={`text-2xl font-black leading-none ${isLow ? 'text-red-500' : 'text-foreground'}`}>{item.quantity}</p>
                {isLow
                    ? <span className="inline-block mt-1 px-1.5 py-0.5 rounded-md bg-red-50 text-[9px] font-black text-red-500 uppercase">{t('low')}</span>
                    : <p className="text-[10px] font-black text-gray-300 uppercase mt-1">{item.unit ? labelOf(tUnits, item.unit) : t('defaultUnit')}</p>}
            </div>

            <button
                onClick={() => onMove(item, 'OUT')}
                disabled={cannotMove || notEnough}
                aria-label={t('removeFrom', { count: quantity, product: item.productName })}
                aria-describedby={notEnough ? hintId : undefined}
                aria-busy={isPending}
                className={`${buttonClass} bg-red-50 text-red-600`}
            >
                {isPending ? <Loader2 className="animate-spin" size={20} /> : <><Minus size={16} strokeWidth={3} /><span className="text-lg font-black">{quantity}</span></>}
            </button>
            <button
                onClick={() => onMove(item, 'IN')}
                disabled={cannotMove}
                aria-label={t('addTo', { count: quantity, product: item.productName })}
                aria-busy={isPending}
                className={`${buttonClass} bg-green-50 text-green-600`}
            >
                {isPending ? <Loader2 className="animate-spin" size={20} /> : <><Plus size={16} strokeWidth={3} /><span className="text-lg font-black">{quantity}</span></>}
            </button>
        </div>
    );
}

export default memo(StockRow);
