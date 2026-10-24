"use client";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, X, AlertCircle, Undo2 } from "lucide-react";
import useSWR, { useSWRConfig } from "swr";
import { useTranslations } from "next-intl";
import { fetcher, STOCK_REFRESH_INTERVAL } from "@/lib/fetcher";
import { MOVEMENT_REASONS } from "@/lib/constants";
import RunnerHeader from "@/components/main/runner/RunnerHeader";
import QuantityToolbar from "@/components/main/runner/QuantityToolbar";
import StockRow from "@/components/main/runner/StockRow";
import type { MovementType, StockItem } from "@/types/models";

type Item = StockItem<string>;

interface RunnerInventoryProps {
    initialItems: Item[];
    assignedAreaCount: number;
}

/** A completed move (that can be undone), an undone one, or a move that failed. */
type Toast =
    | { kind: 'moved'; item: Item; type: MovementType; amount: number }
    | { kind: 'undone'; productName: string }
    | { kind: 'error'; message: string };

const INVENTORY_KEY = '/api/admin/inventory';

/** How long the toast (and its Undo button) stays on screen. */
const TOAST_DURATION = 5000;

/** Groups items by department, for the area chips and the department separators. */
const groupByDepartment = (items: Item[], fallbackName: string) =>
    Object.entries(items.reduce<Record<string, { name: string; items: Item[] }>>((groups, item) => {
        (groups[item.departmentId] ||= { name: item.departmentName || fallbackName, items: [] }).items.push(item);
        return groups;
    }, {})).map(([id, group]) => ({ id, ...group }));

/** Lowercase without accents, so "cafe" finds "Café" (product names are mostly Spanish). */
const normalizeText = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const setQuantity = (items: Item[] = [], id: string, quantity: (current: number) => number) =>
    items.map(item => item._id !== id ? item : { ...item, quantity: quantity(item.quantity) });

type MoveResult = { newQuantity: number };

/** PATCHes the move; throws with the server's (translated) error message, or an empty one on network errors. */
async function sendMove(id: string, type: MovementType, amount: number, reason: string): Promise<MoveResult> {
    const res = await fetch(`/api/admin/inventory/${id}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, type, reason })
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) throw new Error(body?.error ?? "");
    return body;
}

export default function RunnerInventory({ initialItems, assignedAreaCount }: RunnerInventoryProps) {
    const t = useTranslations('runner');
    const tCommon = useTranslations('common');

    const [search, setSearch] = useState("");
    const [globalQty, setGlobalQty] = useState(1);
    const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
    const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
    const [toast, setToast] = useState<Toast | null>(null);
    const [lastUpdated, setLastUpdated] = useState(() => Date.now());

    // Polls so every runner sees stock changes made by others. The server just rendered fresh data,
    // so there's no fetch on mount: the first one comes with the interval or when the tab regains focus.
    const { data: items = [], mutate, isValidating, error } = useSWR<Item[]>(INVENTORY_KEY, fetcher, {
        fallbackData: initialItems,
        revalidateOnMount: false,
        refreshInterval: STOCK_REFRESH_INTERVAL,
        revalidateOnFocus: true,
        onSuccess: () => setLastUpdated(Date.now()),
    });

    // The bound mutate can't take a mutation that resolves to something other than the list (the move result)
    const { mutate: mutateKey } = useSWRConfig();

    // Each toast replaces the previous one and hides itself
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), TOAST_DURATION);
        return () => clearTimeout(timer);
    }, [toast]);

    const fallbackName = tCommon('general');
    const allDepartments = useMemo(() => groupByDepartment(items, fallbackName), [items, fallbackName]);
    // A filter for an area that no longer has stock shows everything
    const activeDepartment = allDepartments.some(d => d.id === departmentFilter) ? departmentFilter : null;

    // Filtering waits for typing to settle, so keystrokes stay responsive on long lists.
    // Memoized so a toast or a pending move doesn't re-filter the whole list.
    const deferredSearch = useDeferredValue(search);
    const departments = useMemo(() => {
        const searchTerm = normalizeText(deferredSearch.trim());
        const filteredItems = items.filter(item =>
            (!activeDepartment || item.departmentId === activeDepartment) &&
            [item.productName, item.sku, item.departmentName].some(text => normalizeText(text || '').includes(searchTerm))
        );
        return groupByDepartment(filteredItems, fallbackName);
    }, [items, activeDepartment, deferredSearch, fallbackName]);

    const setPending = (id: string, pending: boolean) => setPendingIds(ids => {
        const next = new Set(ids);
        if (pending) next.add(id); else next.delete(id);
        return next;
    });

    /** Moves stock with an optimistic update; returns whether the server accepted it. */
    const moveStock = async (id: string, type: MovementType, amount: number, reason: string) => {
        const delta = type === 'IN' ? amount : -amount;
        setPending(id, true);
        try {
            // The server's balance goes into whatever the cache holds when it answers, so moves on other items aren't lost
            await mutateKey<Item[], MoveResult>(INVENTORY_KEY, sendMove(id, type, amount, reason), {
                optimisticData: current => setQuantity(current, id, quantity => Math.max(0, quantity + delta)),
                populateCache: (result, current) => setQuantity(current, id, () => result.newQuantity),
                rollbackOnError: true,
                revalidate: false,
            });
            return true;
        } catch (error) {
            navigator.vibrate?.([40, 60, 40]);
            setToast({ kind: 'error', message: (error as Error).message || t('moveFailed') });
            mutate(); // Someone else may have changed the stock: show the real quantity
            return false;
        } finally {
            setPending(id, false);
        }
    };

    const handleMove = async (item: Item, type: MovementType) => {
        const amount = globalQty;
        if (amount < 1) return;
        const reason = type === 'OUT' ? MOVEMENT_REASONS.RUNNER_CONSUMPTION : MOVEMENT_REASONS.RESTOCK;
        if (await moveStock(item._id, type, amount, reason)) {
            navigator.vibrate?.(15); // A short buzz confirms the tap without looking (ignored where unsupported)
            setToast({ kind: 'moved', item, type, amount });
        }
    };

    // Rows are memoized: give them one callback that never changes but always runs the latest handleMove
    const handleMoveRef = useRef(handleMove);
    useEffect(() => { handleMoveRef.current = handleMove; });
    const onRowMove = useCallback((item: Item, type: MovementType) => handleMoveRef.current(item, type), []);

    const handleUndo = async (item: Item, type: MovementType, amount: number) => {
        setToast(null);
        if (await moveStock(item._id, type === 'IN' ? 'OUT' : 'IN', amount, MOVEMENT_REASONS.CORRECTION)) {
            setToast({ kind: 'undone', productName: item.productName });
        }
    };

    const chipClass = (selected: boolean) =>
        `shrink-0 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border transition-all active:scale-95 ${selected ? 'bg-inverse border-inverse text-on-inverse' : 'bg-card border-line text-ink-muted'}`;

    return (
        <>
            <RunnerHeader
                assignedAreaCount={assignedAreaCount}
                sync={{ isValidating, hasError: !!error, lastUpdated }}
            />

            <QuantityToolbar quantity={globalQty} onQuantityChange={setGlobalQty} search={search} onSearchChange={setSearch} />

            <div className="max-w-md mx-auto px-4 pt-4 pb-24 space-y-6">
                {/* AREA FILTER: only worth showing with more than one area */}
                {allDepartments.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none]">
                        <button onClick={() => setDepartmentFilter(null)} aria-pressed={!activeDepartment} className={chipClass(!activeDepartment)}>
                            {t('allAreas')}
                        </button>
                        {allDepartments.map(department => (
                            <button
                                key={department.id}
                                onClick={() => setDepartmentFilter(department.id)}
                                aria-pressed={activeDepartment === department.id}
                                className={chipClass(activeDepartment === department.id)}
                            >
                                {department.name}
                            </button>
                        ))}
                    </div>
                )}

                {departments.map(department => (
                    <section key={department.id} aria-labelledby={`area-${department.id}`} className="space-y-2.5">
                        {/* DEPARTMENT SEPARATOR */}
                        <div className="flex items-center gap-3 px-1">
                            <MapPin size={14} className="text-ink-subtle shrink-0" aria-hidden />
                            <h2 id={`area-${department.id}`} className="text-[11px] font-black text-ink-muted uppercase tracking-[0.15em] select-none">
                                {department.name}
                            </h2>
                            <div className="h-px flex-1 bg-linear-to-r from-line to-transparent rounded-full"></div>
                        </div>

                        {department.items.map(item => (
                            <StockRow
                                key={item._id}
                                item={item}
                                quantity={globalQty}
                                isPending={pendingIds.has(item._id)}
                                onMove={onRowMove}
                            />
                        ))}
                    </section>
                ))}

                {departments.length === 0 && (
                    <div className="text-center py-20 text-ink-subtle font-bold">{t('noProducts')}</div>
                )}
            </div>

            {/* TOAST: result of the last move, with Undo. Dark in both themes, so it stands out from the list */}
            <div aria-live="polite" className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center pointer-events-none">
                {toast && (
                    <div
                        role={toast.kind === 'error' ? 'alert' : 'status'}
                        className={`pointer-events-auto w-full max-w-md flex items-center gap-3 pl-5 pr-2 py-2 rounded-2xl shadow-2xl ${toast.kind === 'error' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-white ring-1 ring-white/10'}`}
                    >
                        {toast.kind === 'error' && <AlertCircle size={20} className="shrink-0" />}
                        <p className="flex-1 min-w-0 py-2 text-sm font-bold truncate">
                            {toast.kind === 'moved' && <><span className={toast.type === 'OUT' ? 'text-red-300' : 'text-green-300'}>{toast.type === 'OUT' ? '−' : '+'}{toast.amount}</span> {toast.item.productName}</>}
                            {toast.kind === 'undone' && t('undone', { product: toast.productName })}
                            {toast.kind === 'error' && toast.message}
                        </p>
                        {toast.kind === 'moved' && (
                            <button
                                onClick={() => handleUndo(toast.item, toast.type, toast.amount)}
                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
                            >
                                <Undo2 size={14} /> {t('undo')}
                            </button>
                        )}
                        <button onClick={() => setToast(null)} aria-label={t('dismiss')} className="p-2.5 rounded-xl text-white/60 hover:text-white">
                            <X size={16} />
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
