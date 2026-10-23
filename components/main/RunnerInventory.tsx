"use client";
import { useEffect, useState } from "react";
import { Search, Minus, Plus, Loader2, RotateCcw, LayoutDashboard, LogOut, MapPin, X, AlertCircle, Undo2 } from "lucide-react";
import { signOut } from "next-auth/react";
import useSWR, { useSWRConfig } from "swr";
import { useTranslations } from "next-intl";
import { fetcher, STOCK_REFRESH_INTERVAL } from "@/lib/fetcher";
import { MOVEMENT_REASONS, ROLES } from "@/lib/constants";
import { labelOf } from "@/i18n/labels";
import type { MovementType, StockItem } from "@/types/models";

type Item = StockItem<string>;

interface RunnerInventoryProps {
    initialItems: Item[];
    userRole: string;
    permissions: Record<string, boolean>;
}

/** A completed move (that can be undone), an undone one, or a move that failed. */
type Toast =
    | { kind: 'moved'; item: Item; type: MovementType; amount: number }
    | { kind: 'undone'; productName: string }
    | { kind: 'error'; message: string };

const INVENTORY_KEY = '/api/admin/inventory';

/** How long the toast (and its Undo button) stays on screen. */
const TOAST_DURATION = 5000;

/** Groups items by department, for the department separators. */
const groupByDepartment = (items: Item[], fallbackName: string) =>
    Object.values(items.reduce<Record<string, { name: string; items: Item[] }>>((groups, item) => {
        (groups[item.departmentId] ||= { name: item.departmentName || fallbackName, items: [] }).items.push(item);
        return groups;
    }, {}));

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

export default function RunnerInventory({ initialItems, userRole, permissions }: RunnerInventoryProps) {
    const t = useTranslations('runner');
    const tCommon = useTranslations('common');
    const tUnits = useTranslations('units');

    const [search, setSearch] = useState("");
    const [globalQty, setGlobalQty] = useState(1);
    const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
    const [toast, setToast] = useState<Toast | null>(null);

    // Polls so every runner sees stock changes made by others
    const { data: items = [], mutate } = useSWR<Item[]>(INVENTORY_KEY, fetcher, {
        fallbackData: initialItems,
        refreshInterval: STOCK_REFRESH_INTERVAL,
        revalidateOnFocus: true,
    });

    // The bound mutate can't take a mutation that resolves to something other than the list (the move result)
    const { mutate: mutateKey } = useSWRConfig();

    // Each toast replaces the previous one and hides itself
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), TOAST_DURATION);
        return () => clearTimeout(timer);
    }, [toast]);

    const searchTerm = search.toLowerCase();
    const filteredItems = items.filter(item =>
        item.productName.toLowerCase().includes(searchTerm) ||
        item.sku.toLowerCase().includes(searchTerm)
    );
    const departments = groupByDepartment(filteredItems, tCommon('general'));
    const canOpenDashboard = userRole === ROLES.ADMIN || userRole === ROLES.SUPERADMIN || permissions.view_dashboard === true;

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
            setToast({ kind: 'moved', item, type, amount });
        }
    };

    const handleUndo = async (item: Item, type: MovementType, amount: number) => {
        setToast(null);
        if (await moveStock(item._id, type === 'IN' ? 'OUT' : 'IN', amount, MOVEMENT_REASONS.CORRECTION)) {
            setToast({ kind: 'undone', productName: item.productName });
        }
    };

    return (
        <div className="max-w-md mx-auto p-5 space-y-6">

            <div className="flex items-center justify-between gap-4 px-2">
                {canOpenDashboard && (
                    <a
                        href="/dashboard"
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                    >
                        <LayoutDashboard size={16} /> {tCommon('dashboard')}
                    </a>
                )}

                <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-100 text-gray-400 rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm active:scale-95 transition-all hover:text-red-500"
                >
                    <LogOut size={16} /> {tCommon('logout')}
                </button>
            </div>

            {/* 1. QUANTITY CONTROLLER (Sticky) */}
            <div className="sticky top-4 z-30 bg-white p-5 rounded-[2.5rem] shadow-2xl border border-gray-100 ring-4 ring-gray-50/50">
                <div className="flex flex-col items-center">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">
                        {t('quantityTitle')}
                    </p>

                    <div className="flex items-center justify-between w-full gap-4">
                        <button
                            onClick={() => setGlobalQty(Math.max(1, globalQty - 1))}
                            disabled={globalQty <= 1}
                            className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-600 active:scale-90 transition-all disabled:opacity-30"
                        >
                            <Minus size={24} strokeWidth={3} />
                        </button>

                        <div className="flex-1 flex flex-col items-center">
                            {/* Can be cleared while typing; it goes back to at least 1 on blur */}
                            <input
                                type="number"
                                min={1}
                                value={globalQty || ""}
                                onChange={(e) => setGlobalQty(Math.max(0, parseInt(e.target.value) || 0))}
                                onBlur={() => setGlobalQty(Math.max(1, globalQty))}
                                className="w-full text-center text-4xl font-black text-[#171717] outline-none bg-transparent"
                            />
                            <div className="h-1.5 w-12 bg-blue-500 rounded-full mt-1"></div>
                        </div>

                        <button
                            onClick={() => setGlobalQty(globalQty + 1)}
                            className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-600 active:scale-90 transition-all"
                        >
                            <Plus size={24} strokeWidth={3} />
                        </button>
                    </div>

                    <button
                        onClick={() => setGlobalQty(1)}
                        className="mt-4 flex items-center gap-2 text-[11px] font-black text-gray-300 uppercase hover:text-blue-500 transition-colors"
                    >
                        <RotateCcw size={12} /> {t('reset')}
                    </button>
                </div>
            </div>

            {/* 2. SEARCH */}
            <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-800" size={20} />
                <input
                    type="text"
                    placeholder={t('search')}
                    className="w-full bg-white text-gray-800 p-6 pl-16 rounded-3xl text-lg font-bold shadow-sm border border-gray-100 outline-none focus:ring-2 ring-blue-100 transition-all"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* 3. PRODUCT CARDS */}
            <div className="space-y-12">
                {departments.map(department => (
                    <div key={department.items[0].departmentId} className="space-y-4">
                        {/* DEPARTMENT SEPARATOR */}
                        <div className="flex items-center gap-4 px-2">
                            <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-50/80 rounded-2xl border border-slate-100/50 shadow-sm">
                                <MapPin size={14} className="text-slate-400" />
                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] select-none">
                                    {department.name}
                                </span>
                            </div>
                            {/* Subtle line that fades out */}
                            <div className="h-px flex-1 bg-linear-to-r from-slate-200 to-transparent rounded-full"></div>
                        </div>

                        {/* CARDS FOR THIS DEPARTMENT */}
                        <div className="space-y-4">
                            {department.items.map(item => {
                                const isPending = pendingIds.has(item._id);
                                const cannotMove = isPending || globalQty < 1;
                                return (
                                    <div key={item._id} className="bg-white p-7 rounded-[3rem] border border-gray-100 shadow-sm">
                                        <div className="flex justify-between items-start mb-8">
                                            <div>
                                                <h3 className="text-xl font-black text-[#171717] leading-tight mb-1">{item.productName}</h3>
                                                <span className="text-xs font-bold text-blue-500 uppercase tracking-tighter">{item.sku}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-3xl font-black leading-none ${item.quantity <= (item.minStock || 0) ? 'text-red-500' : 'text-[#171717]'}`}>{item.quantity}</p>
                                                <p className="text-[10px] font-black text-gray-300 uppercase mt-2">{item.unit ? labelOf(tUnits, item.unit) : t('defaultUnit')}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <button onClick={() => handleMove(item, 'OUT')} disabled={cannotMove || item.quantity < globalQty} className="flex flex-row items-center justify-center gap-2 bg-red-50 text-red-600 py-6 rounded-3xl active:scale-95 transition-all disabled:opacity-20">
                                                {isPending ? <Loader2 className="animate-spin" /> : <><Minus size={32} strokeWidth={3} /><span className="text-2xl font-black uppercase">{globalQty}</span></>}
                                            </button>
                                            <button onClick={() => handleMove(item, 'IN')} disabled={cannotMove} className="flex flex-row items-center justify-center gap-2 bg-green-50 text-green-600 py-6 rounded-3xl active:scale-95 transition-all disabled:opacity-20">
                                                {isPending ? <Loader2 className="animate-spin" /> : <><Plus size={32} strokeWidth={3} /><span className="text-2xl font-black uppercase">{globalQty}</span></>}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {departments.length === 0 && (
                    <div className="text-center py-20 text-gray-400 font-bold">{t('noProducts')}</div>
                )}
            </div>

            {/* 4. TOAST: result of the last move, with Undo */}
            <div aria-live="polite" className="fixed inset-x-4 bottom-20 z-40 flex justify-center pointer-events-none">
                {toast && (
                    <div
                        role={toast.kind === 'error' ? 'alert' : 'status'}
                        className={`pointer-events-auto w-full max-w-md flex items-center gap-3 pl-5 pr-2 py-2 rounded-2xl shadow-2xl ${toast.kind === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`}
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
        </div>
    );
}
