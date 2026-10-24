"use client";
import { Minus, Plus, ScanBarcode, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

/** Quick picks for the quantity to move. */
const QUANTITY_PRESETS = [1, 5, 10];

interface QuantityToolbarProps {
    quantity: number;
    onQuantityChange: (quantity: number) => void;
    search: string;
    onSearchChange: (search: string) => void;
    /** Enter in the search: what a USB/Bluetooth scanner sends after typing the code */
    onSearchSubmit: (search: string) => void;
    /** Opens the camera scanner */
    onScan: () => void;
}

/** Sticky bar with the quantity every −/+ button moves, the product search and the barcode scanner. */
export default function QuantityToolbar({ quantity, onQuantityChange, search, onSearchChange, onSearchSubmit, onScan }: QuantityToolbarProps) {
    const t = useTranslations('runner');

    const stepClass = "w-11 h-11 shrink-0 bg-subtle rounded-xl flex items-center justify-center text-ink-muted active:scale-90 transition-all disabled:opacity-30";

    return (
        <div className="sticky top-0 z-30 bg-canvas/95 backdrop-blur-md px-4 pt-3 pb-3 border-b border-line">
            <div className="max-w-md mx-auto space-y-2">
                <div role="group" aria-label={t('quantityTitle')} className="flex items-center gap-2 bg-card p-1.5 rounded-2xl border border-line shadow-sm">
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
                        className="w-full min-w-0 h-11 text-center text-2xl font-black text-ink outline-none bg-transparent rounded-xl focus-visible:bg-accent/10"
                    />
                    <button onClick={() => onQuantityChange(quantity + 1)} aria-label={t('increaseQuantity')} className={stepClass}>
                        <Plus size={20} strokeWidth={3} />
                    </button>

                    <div className="w-px h-8 bg-line shrink-0" />
                    {QUANTITY_PRESETS.map(preset => (
                        <button
                            key={preset}
                            onClick={() => onQuantityChange(preset)}
                            aria-label={t('setQuantity', { count: preset })}
                            aria-pressed={quantity === preset}
                            className={`w-10 h-11 shrink-0 rounded-xl text-sm font-black transition-all active:scale-90 ${quantity === preset ? 'bg-inverse text-on-inverse' : 'text-ink-muted hover:bg-subtle'}`}
                        >
                            {preset}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle" size={18} />
                        <input
                            type="search"
                            aria-label={t('search')}
                            placeholder={t('search')}
                            className="w-full bg-card text-ink h-12 pl-11 pr-11 rounded-2xl text-base font-bold border border-line shadow-sm outline-none focus:ring-2 ring-accent/30 transition-all [&::-webkit-search-cancel-button]:hidden"
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSearchSubmit(search); } }}
                        />
                        {search && (
                            <button
                                onClick={() => onSearchChange("")}
                                aria-label={t('clearSearch')}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-xl text-ink-subtle hover:text-ink"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={onScan}
                        aria-label={t('scan')}
                        title={t('scan')}
                        className="w-12 h-12 shrink-0 flex items-center justify-center rounded-2xl bg-inverse text-on-inverse shadow-sm active:scale-95 transition-all"
                    >
                        <ScanBarcode size={22} />
                    </button>
                </div>
            </div>
        </div>
    );
}
