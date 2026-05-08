"use client";
import { useState, useEffect } from "react";
import { Search, Plus, Minus, AlertTriangle, Package, History, ArrowLeft, Hash, Ruler, RefreshCw } from "lucide-react";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/Datatable";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { useRouter } from "next/navigation";
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function StockManagementClient({ initialInventory, departmentId, departmentName }: any) {

    const { data: inventory, mutate } = useSWR(
        `/api/admin/departments/${departmentId}/stock`,
        fetcher,
        { fallbackData: initialInventory, refreshInterval: 5000 } // Polls every 5 seconds
    );

    const handleQuickMove = async (item: any, type: "IN" | "OUT") => {
        const amount = 1;

        // 1. OPTIMISTIC UPDATE: Update UI immediately before the server responds
        const optimisticData = inventory.map((i: any) => {
            if (i._id === item._id) {
                return { ...i, quantity: type === "IN" ? i.quantity + amount : i.quantity - amount };
            }
            return i;
        });

        // 'false' tells SWR not to re-validate from server yet
        mutate(optimisticData, false);

        // 2. SERVER UPDATE
        await fetch(`/api/admin/inventory/${item._id}/move`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount, type, reason: "Ajuste rápido Admin" })
        });

        // 3. FINAL SYNC: Refresh data for everyone
        mutate();
    };

    // const [inventory, setInventory] = useState(initialInventory);
    const [searchTerm, setSearchTerm] = useState("");

    // Filtered list based on search
    const filteredInventory = inventory.filter((item: any) =>
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    //table headers
    const tableHeaders = [{ title: "Producto / SKU" }, { title: "Categoría" }, { title: "Cantidad Actual" }, { title: "Acciones Rápidas" }];

    // Stats calculation
    const lowStockCount = inventory.filter((i: any) => i.quantity <= i.minStock).length;

    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        sku: "",
        unit: "unidades",
        quantity: 0,
        minStock: 5
    });

    const generateSKU = (deptName: string) => {
        const prefix = deptName.substring(0, 3).toUpperCase().replace(/\s/g, 'X');
        const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit number
        return `${prefix}-${randomNum}`;
    };

    const handleOpenModal = () => {
        const newSKU = generateSKU(departmentName);
        setFormData({
            ...formData,
            sku: newSKU,
            name: "",
            quantity: 0
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.sku) {
            alert("Nombre y SKU son obligatorios");
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch(`/api/admin/departments/${departmentId}/stock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setIsModalOpen(false);
                setFormData({ name: "", sku: "", unit: "unidades", quantity: 0, minStock: 5 });
                router.refresh();
            }
            router.refresh();
        } catch (error) {
            console.error("Error saving stock:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            {/* THE MODAL */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Registrar Nuevo Producto"
            >
                <div className="space-y-5">
                    {/* PRODUCT NAME */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block ml-1">Nombre del Artículo</label>
                        <div className="relative">
                            <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                            <input
                                type="text"
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 pl-12 pr-4 text-sm outline-none focus:border-[#0070f3] transition-all"
                                placeholder="Ej. Resma de Papel A4"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* SKU */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block ml-1">
                                SKU Autogenerado
                            </label>
                            <div className="relative flex items-center">
                                <Hash className="absolute left-4 text-gray-300" size={16} />
                                <input
                                    type="text"
                                    readOnly // Optional: keep it read-only to enforce the format
                                    className="w-full bg-gray-100 border border-gray-100 rounded-xl py-3 pl-12 pr-12 text-sm font-mono font-bold text-[#0070f3] outline-none"
                                    value={formData.sku}
                                />
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, sku: generateSKU(departmentName) })}
                                    className="absolute right-3 p-1.5 text-gray-400 hover:text-[#0070f3] transition-colors"
                                    title="Generar otro código"
                                >
                                    <RefreshCw size={14} />
                                </button>
                            </div>
                        </div>

                        {/* UNIT */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block ml-1">Unidad</label>
                            <div className="relative">
                                <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                <select
                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 pl-12 pr-4 text-sm outline-none focus:border-[#0070f3] appearance-none"
                                    value={formData.unit}
                                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                >
                                    <option value="unidades">Unidades</option>
                                    <option value="kg">Kilogramos</option>
                                    <option value="cajas">Cajas</option>
                                    <option value="litros">Litros</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100 my-2" />

                    <div className="grid grid-cols-2 gap-4">
                        {/* INITIAL STOCK */}
                        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                            <label className="text-[10px] font-black text-[#0070f3] uppercase mb-1 block">Stock Inicial</label>
                            <input
                                type="number"
                                className="w-full bg-transparent text-2xl font-black text-[#171717] outline-none"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                            />
                        </div>

                        {/* MIN STOCK */}
                        <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
                            <label className="text-[10px] font-black text-orange-600 uppercase mb-1 block">Mínimo (Alerta)</label>
                            <input
                                type="number"
                                className="w-full bg-transparent text-2xl font-black text-[#171717] outline-none"
                                value={formData.minStock}
                                onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full bg-[#171717] text-white py-4 rounded-2xl font-black hover:bg-black transition-all flex items-center justify-center gap-2 mt-4 shadow-xl shadow-gray-200"
                    >
                        {isSaving ? "Guardando..." : "Registrar en Inventario"}
                    </button>
                </div>
            </Modal>
            <div className="space-y-6">
                {/* 1. TOP NAVIGATION & ACTION BAR */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <Link
                        href="/admin/departments"
                        className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-[#171717] transition-colors"
                    >
                        <ArrowLeft size={14} /> VOLVER A DEPARTAMENTOS
                    </Link>

                    <div className="flex items-center gap-3">
                        <button onClick={handleOpenModal} className="flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-xl text-xs font-bold hover:bg-black transition-all shadow-lg shadow-gray-200">
                            <Plus size={16} /> AGREGAR PRODUCTO
                        </button>
                        <Link href={`/admin/departments/${departmentId}/report`} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all">
                            <History size={16} /> VER REPORTE
                        </Link>
                    </div>
                </div>

                {/* 2. QUICK STATS CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total SKU</p>
                        <p className="text-2xl font-black text-[#171717]">{inventory.length}</p>
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex justify-between items-center">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bajo Stock</p>
                            <p className="text-2xl font-black text-orange-500">{lowStockCount}</p>
                        </div>
                        {lowStockCount > 0 && <AlertTriangle className="text-orange-500 opacity-20" size={32} />}
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor Estimado</p>
                        <p className="text-2xl font-black text-[#0070f3]">$---</p>
                    </div>
                </div>

                {/* 3. SEARCH & FILTERS */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o SKU..."
                        className="w-full bg-white border-none rounded-2xl py-4 pl-12 pr-4 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* 4. STOCK TABLE */}
                <DataTable headers={tableHeaders}>
                    {filteredInventory.map((item: any) => (
                        <DataTableRow key={item._id}>
                            <DataTableCell>
                                <div className="flex flex-col">
                                    <span className="font-bold text-[#171717]">{item.productName}</span>
                                    <span className="text-[10px] text-gray-400 font-mono tracking-tighter uppercase">{item.sku}</span>
                                </div>
                            </DataTableCell>

                            <DataTableCell>
                                <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-bold uppercase">
                                    {item.category || 'General'}
                                </span>
                            </DataTableCell>

                            <DataTableCell>
                                <div className="flex items-center gap-3">
                                    <span className={`text-lg font-black ${item.quantity <= item.minStock ? 'text-orange-500' : 'text-[#171717]'}`}>
                                        {item.quantity}
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{item.unit}</span>
                                    {item.quantity <= item.minStock && (
                                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                    )}
                                </div>
                            </DataTableCell>

                            <DataTableCell>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleQuickMove(item, "OUT")}
                                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 active:scale-90 transition-all"
                                    >
                                        <Minus size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleQuickMove(item, "IN")}
                                        className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 active:scale-90 transition-all"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </DataTableCell>
                        </DataTableRow>
                    ))}
                </DataTable>
            </div>
        </>
    );
}