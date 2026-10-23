"use client";
import { useState } from "react";
import { Search, Minus, Plus, Loader2, RotateCcw, LayoutDashboard, LogOut, MapPin } from "lucide-react";
import { signOut } from "next-auth/react";
import useSWR from "swr";
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

/** Groups items by department name, for the department separators. */
const groupByDepartment = (items: Item[], fallbackName: string) =>
    items.reduce<Record<string, Item[]>>((groups, item) => {
        const department = item.departmentName || fallbackName;
        (groups[department] ||= []).push(item);
        return groups;
    }, {});

export default function RunnerInventory({ initialItems, userRole, permissions }: RunnerInventoryProps) {
    const t = useTranslations('runner');
    const tCommon = useTranslations('common');
    const tUnits = useTranslations('units');

    const [search, setSearch] = useState("");
    const [globalQty, setGlobalQty] = useState(1);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Polls so every runner sees stock changes made by others
    const { data: items = [], mutate } = useSWR<Item[]>('/api/admin/inventory', fetcher, {
        fallbackData: initialItems,
        refreshInterval: STOCK_REFRESH_INTERVAL,
        revalidateOnFocus: true,
    });

    const searchTerm = search.toLowerCase();
    const filteredItems = items.filter(item =>
        item.productName.toLowerCase().includes(searchTerm) ||
        item.sku.toLowerCase().includes(searchTerm)
    );
    const groupedItems = groupByDepartment(filteredItems, tCommon('general'));
    const canOpenDashboard = userRole === ROLES.ADMIN || userRole === ROLES.SUPERADMIN || permissions.view_dashboard === true;

    const handleUpdate = async (id: string, type: MovementType) => {
        if (globalQty <= 0) return;
        setProcessingId(id);

        // Optimistic update: show the new quantity before the server responds
        const updatedItems = items.map(item => item._id !== id ? item : {
            ...item,
            quantity: type === 'IN' ? item.quantity + globalQty : Math.max(0, item.quantity - globalQty)
        });
        mutate(updatedItems, false);

        try {
            const res = await fetch(`/api/admin/inventory/${id}/move`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: globalQty,
                    type,
                    reason: type === 'OUT' ? MOVEMENT_REASONS.RUNNER_CONSUMPTION : MOVEMENT_REASONS.RESTOCK
                })
            });

            if (!res.ok) throw new Error("Failed");

            // Re-fetch from server to confirm total is correct
            mutate();
            setGlobalQty(1);
        } catch (error) {
            console.error("Stock update failed:", error);
            mutate(); // Rollback to server data if it fails
        } finally {
            setProcessingId(null);
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
                            onClick={() => setGlobalQty(Math.max(0, globalQty - 1))}
                            className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-600 active:scale-90 transition-all"
                        >
                            <Minus size={24} strokeWidth={3} />
                        </button>

                        <div className="flex-1 flex flex-col items-center">
                            <input
                                type="number"
                                value={globalQty}
                                onChange={(e) => setGlobalQty(Math.max(0, parseInt(e.target.value) || 0))}
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
                {Object.entries(groupedItems).map(([deptName, deptItems]) => (
                    <div key={deptName} className="space-y-4">
                        {/* DEPARTMENT SEPARATOR */}
                        <div className="flex items-center gap-4 px-2">
                            <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-50/80 rounded-2xl border border-slate-100/50 shadow-sm">
                                <MapPin size={14} className="text-slate-400" />
                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] select-none">
                                    {deptName}
                                </span>
                            </div>
                            {/* Subtle line that fades out */}
                            <div className="h-px flex-1 bg-linear-to-r from-slate-200 to-transparent rounded-full"></div>
                        </div>

                        {/* CARDS FOR THIS DEPARTMENT */}
                        <div className="space-y-4">
                            {deptItems.map(item => (
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
                                        <button onClick={() => handleUpdate(item._id, 'OUT')} disabled={processingId === item._id || item.quantity < globalQty} className="flex flex-row items-center justify-center gap-2 bg-red-50 text-red-600 py-6 rounded-3xl active:scale-95 transition-all disabled:opacity-20">
                                            {processingId === item._id ? <Loader2 className="animate-spin" /> : <><Minus size={32} strokeWidth={3} /><span className="text-2xl font-black uppercase">{globalQty}</span></>}
                                        </button>
                                        <button onClick={() => handleUpdate(item._id, 'IN')} disabled={processingId === item._id} className="flex flex-row items-center justify-center gap-2 bg-green-50 text-green-600 py-6 rounded-3xl active:scale-95 transition-all">
                                            {processingId === item._id ? <Loader2 className="animate-spin" /> : <><Plus size={32} strokeWidth={3} /><span className="text-2xl font-black uppercase">{globalQty}</span></>}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {Object.keys(groupedItems).length === 0 && (
                    <div className="text-center py-20 text-gray-400 font-bold">{t('noProducts')}</div>
                )}
            </div>
        </div>
    );
}