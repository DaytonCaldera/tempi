"use client";
import { Minus, Plus, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

/** Quick picks for the quantity to move. */
const QUANTITY_PRESETS = [1, 5, 10];

interface QuantityToolbarProps {
    quantity: number;
    onQuantityChange: (quantity: number) => void;
    search: string;
    onSearchChange: (search: string) => void;
}

/** Sticky bar with the quantity every −/+ button moves, and the product search. */
export default function QuantityToolbar({ quantity, onQuantityChange, search, onSearchChange }: QuantityToolbarProps) {
    const t = useTranslations('runner');

    const stepClass = "w-11 h-11 shrink-0 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 active:scale-90 transition-all disabled:opacity-30";

    return (
        <div className="sticky top-0 z-30 bg-gray-50/95 backdrop-blur-md px-4 pt-3 pb-3 border-b border-gray-100">
            <div className="max-w-md mx-auto space-y-2">
                <div role="group" aria-label={t('quantityTitle')} className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm">
                    <button onClick={() => onQuantityChange(Math.max(1, quantity - 1))} disabled={quantity <= 1} aria-label={t('decreaseQuantity')} className={stepClass}>
                        <Minus size={20} strokeWidth={3} />
                    </button>
                    {/* Numeric keypad on phones; selecting on focus lets a tap-and-type replace the value.
                        Can be cleared while typing; it goes back to at least 1 on blur */}
                    <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        aria-label={t('quantityTitle')}
                        value={quantity || ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => onQuantityChange(Math.max(0, parseInt(e.target.value) || 0))}
                        onBlur={() => onQuantityChange(Math.max(1, quantity))}
                        className="w-full min-w-0 h-11 text-center text-2xl font-black text-foreground outline-none bg-transparent rounded-xl focus-visible:bg-blue-50"
                    />
                    <button onClick={() => onQuantityChange(quantity + 1)} aria-label={t('increaseQuantity')} className={stepClass}>
                        <Plus size={20} strokeWidth={3} />
                    </button>

                    <div className="w-px h-8 bg-gray-100 shrink-0" />
                    {QUANTITY_PRESETS.map(preset => (
                        <button
                            key={preset}
                            onClick={() => onQuantityChange(preset)}
                            aria-label={t('setQuantity', { count: preset })}
                            aria-pressed={quantity === preset}
                            className={`w-10 h-11 shrink-0 rounded-xl text-sm font-black transition-all active:scale-90 ${quantity === preset ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            {preset}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="search"
                        aria-label={t('search')}
                        placeholder={t('search')}
                        className="w-full bg-white text-gray-800 h-12 pl-11 pr-11 rounded-2xl text-base font-bold border border-gray-100 shadow-sm outline-none focus:ring-2 ring-blue-100 transition-all [&::-webkit-search-cancel-button]:hidden"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    {search && (
                        <button
                            onClick={() => onSearchChange("")}
                            aria-label={t('clearSearch')}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
