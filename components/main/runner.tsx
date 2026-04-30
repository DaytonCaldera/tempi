"use client";
import React, { useState, useEffect } from "react";
import { Search, Minus, Plus, Package, Loader2, RotateCcw, LayoutDashboard, Link, LogOut, MapPin } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import useSWR from "swr";

// 1. Fetcher function for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function RunnerInventoryClient({ initialItems, userRole }: { initialItems: any[]; userRole: string }) {
    const { data: session } = useSession();
    const [search, setSearch] = useState("");
    const [globalQty, setGlobalQty] = useState(1);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // 2. Real-Time Sync using SWR
    // We fetch based on the department(s) the user has access to.
    // Note: In a real scenario, you'd pass the deptIds to this endpoint.
    const { data: items, mutate } = useSWR(
        '/api/admin/inventory', // Or your specific runner-inventory endpoint
        fetcher,
        {
            fallbackData: initialItems,
            refreshInterval: 2500, // Polls every 2.5 seconds for background updates,
            revalidateOnFocus: true, // Re-fetches data when the window regains focus
            dedupingInterval: 2000 // Prevents duplicate requests within 2 seconds
        }
    );

    // Filter Logic (using the SWR data 'items')
    const filteredItems = items?.filter((item: any) =>
        item.productName.toLowerCase().includes(search.toLowerCase()) ||
        item.sku.toLowerCase().includes(search.toLowerCase())
    ) || [];

    const groupedItems = filteredItems.reduce((acc: any, item: any) => {
        console.log(item.departmentName);

        const dept = item.departmentName || "General";
        if (!acc[dept]) acc[dept] = [];
        acc[dept].push(item);
        return acc;
    }, {});

    const handleUpdate = async (id: string, type: 'IN' | 'OUT') => {
        if (globalQty <= 0) return;
        setProcessingId(id);

        // Optimistic UI Update: Change the number locally before the server responds
        const currentItem = items.find((i: any) => i._id === id);
        const optimisticQty = type === 'IN'
            ? currentItem.quantity + globalQty
            : Math.max(0, currentItem.quantity - globalQty);

        const updatedItems = items.map((i: any) =>
            i._id === id ? { ...i, quantity: optimisticQty } : i
        );

        // Tell SWR to show the new number immediately
        mutate(updatedItems, false);

        try {
            const res = await fetch(`/api/admin/inventory/move`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    amount: globalQty,
                    type,
                    user: { name: session?.user?.name, email: session?.user?.email }
                })
            });

            if (!res.ok) throw new Error("Failed");

            // Re-fetch from server to confirm total is correct
            mutate();
            setGlobalQty(1);
        } catch (error) {
            console.error("Update failed");
            mutate(); // Rollback to server data if it fails
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="max-w-md mx-auto p-5 space-y-6">

            <div className="flex items-center justify-between gap-4 px-2">
                {(userRole === 'admin' || userRole === 'superadmin') && (
                    <a
                        href="/dashboard"
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                    >
                        <LayoutDashboard size={16} /> Dashboard
                    </a>
                )}

                <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-100 text-gray-400 rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm active:scale-95 transition-all hover:text-red-500"
                >
                    <LogOut size={16} /> Salir
                </button>
            </div>

            {/* 1. QUANTITY CONTROLLER (Sticky) */}
            <div className="sticky top-4 z-30 bg-white p-5 rounded-[2.5rem] shadow-2xl border border-gray-100 ring-4 ring-gray-50/50">
                <div className="flex flex-col items-center">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">
                        Cantidad a mover
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
                        <RotateCcw size={12} /> Resetear a 1
                    </button>
                </div>
            </div>

            {/* 2. SEARCH */}
            <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-800" size={20} />
                <input
                    type="text"
                    placeholder="Buscar producto..."
                    className="w-full bg-white text-gray-800 p-6 pl-16 rounded-3xl text-lg font-bold shadow-sm border border-gray-100 outline-none focus:ring-2 ring-blue-100 transition-all"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* 3. PRODUCT CARDS */}
            <div className="space-y-12">
                {Object.entries(groupedItems).map(([deptName, items]: [string, any]) => (
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
                            {items.map((item: any) => (
                                <div key={item._id} className="bg-white p-7 rounded-[3rem] border border-gray-100 shadow-sm">
                                    <div className="flex justify-between items-start mb-8">
                                        <div>
                                            <h3 className="text-xl font-black text-[#171717] leading-tight mb-1">{item.productName}</h3>
                                            <span className="text-xs font-bold text-blue-500 uppercase tracking-tighter">{item.sku}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-3xl font-black leading-none ${item.quantity <= (item.minStock || 0) ? 'text-red-500' : 'text-[#171717]'}`}>{item.quantity}</p>
                                            <p className="text-[10px] font-black text-gray-300 uppercase mt-2">{item.unit || 'uds'}</p>
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
                    <div className="text-center py-20 text-gray-400 font-bold">No se encontraron productos.</div>
                )}
            </div>
        </div>
    );
}