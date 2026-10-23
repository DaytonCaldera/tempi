"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus, AlertTriangle, History, ArrowLeft } from "lucide-react";
import { useDepartmentStock, type StockRow } from "./useDepartmentStock";
import { StockItemModal } from "./StockItemModal";
import { DeleteStockItemModal } from "./DeleteStockItemModal";
import { StockTable } from "./StockTable";

interface StockManagementClientProps {
    initialInventory: StockRow[];
    departmentId: string;
    departmentName: string;
}

/** Admin view of a department's inventory: stats, search, quick +/- moves, create, edit and delete. */
export default function StockManagementClient({ initialInventory, departmentId, departmentName }: StockManagementClientProps) {
    const router = useRouter();
    const { inventory, quickMove, remove } = useDepartmentStock(departmentId, initialInventory);

    const [searchTerm, setSearchTerm] = useState("");
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formKey, setFormKey] = useState(0);
    const [editingItem, setEditingItem] = useState<StockRow | null>(null);
    const [deletingItem, setDeletingItem] = useState<StockRow | null>(null);

    const search = searchTerm.toLowerCase();
    const filteredInventory = inventory.filter(item =>
        item.productName.toLowerCase().includes(search) ||
        item.sku.toLowerCase().includes(search)
    );
    const lowStockCount = inventory.filter(item => item.quantity <= item.minStock).length;

    const openForm = (item: StockRow | null) => {
        setEditingItem(item);
        setFormKey(key => key + 1); // Remounts the form so it starts fresh
        setIsFormOpen(true);
    };

    return (
        <>
            <StockItemModal
                key={formKey}
                isOpen={isFormOpen}
                editingItem={editingItem}
                departmentId={departmentId}
                departmentName={departmentName}
                onClose={() => setIsFormOpen(false)}
                onSaved={() => {
                    setIsFormOpen(false);
                    router.refresh();
                }}
            />

            <DeleteStockItemModal
                item={deletingItem}
                onCancel={() => setDeletingItem(null)}
                onConfirm={async (item) => {
                    await remove(item);
                    setDeletingItem(null);
                }}
            />

            <div className="space-y-6">
                {/* NAVIGATION & ACTIONS */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <Link
                        href="/admin/departments"
                        className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-[#171717] transition-colors"
                    >
                        <ArrowLeft size={14} /> VOLVER A DEPARTAMENTOS
                    </Link>

                    <div className="flex items-center gap-3">
                        <button onClick={() => openForm(null)} className="flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-xl text-xs font-bold hover:bg-black transition-all shadow-lg shadow-gray-200">
                            <Plus size={16} /> AGREGAR PRODUCTO
                        </button>
                        <Link href={`/admin/departments/${departmentId}/report`} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all">
                            <History size={16} /> VER REPORTE
                        </Link>
                    </div>
                </div>

                {/* STATS */}
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

                {/* SEARCH */}
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

                <StockTable
                    items={filteredInventory}
                    onQuickMove={quickMove}
                    onEdit={openForm}
                    onDelete={setDeletingItem}
                />
            </div>
        </>
    );
}
