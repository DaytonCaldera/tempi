"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { PERMISSIONS } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";
import { Search, Plus, AlertTriangle, History, ArrowLeft, Upload } from "lucide-react";
import { useDepartmentStock, type StockRow } from "./useDepartmentStock";
import { StockItemModal } from "./StockItemModal";
import { StockImportModal } from "./StockImportModal";
import { TransferStockModal } from "./TransferStockModal";
import { DeleteStockItemModal } from "./DeleteStockItemModal";
import { StockTable } from "./StockTable";

interface StockManagementClientProps {
    initialInventory: StockRow[];
    departmentId: string;
    departmentName: string;
    /** Opens the new product form with this barcode (from the runner's "create product" for an unknown code) */
    newBarcode?: string;
    /** The organization's other departments, the ones products can be transferred to */
    otherDepartments: { _id: string; name: string }[];
    /** The organization's currency */
    currency: string;
    /** Whether the user's role may delete products (PERMISSIONS.DELETE_STOCK) */
    canDelete: boolean;
}

/** Admin view of a department's inventory: stats, search, quick +/- moves, create, edit and delete. */
export default function StockManagementClient({ initialInventory, departmentId, departmentName, newBarcode, otherDepartments, currency, canDelete }: StockManagementClientProps) {
    const t = useTranslations("stock");
    const format = useFormatter();
    const router = useRouter();
    const { inventory, quickMove, remove, refresh } = useDepartmentStock(departmentId, initialInventory);
    // Links only to the pages the user's role can open
    const { data: session } = useSession();
    const canManageDepartments = hasPermission(session, PERMISSIONS.MANAGE_DEPTS);
    const canSeeReports = hasPermission(session, PERMISSIONS.VIEW_REPORTS);

    const [searchTerm, setSearchTerm] = useState("");
    const [isFormOpen, setIsFormOpen] = useState(!!newBarcode);
    const [formKey, setFormKey] = useState(0);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importKey, setImportKey] = useState(0);
    const [editingItem, setEditingItem] = useState<StockRow | null>(null);
    const [deletingItem, setDeletingItem] = useState<StockRow | null>(null);
    const [transferringItem, setTransferringItem] = useState<StockRow | null>(null);
    const [transferKey, setTransferKey] = useState(0);

    const search = searchTerm.toLowerCase();
    const filteredInventory = inventory.filter(item =>
        item.productName.toLowerCase().includes(search) ||
        item.sku.toLowerCase().includes(search) ||
        !!item.barcode?.toLowerCase().includes(search)
    );
    const lowStockCount = inventory.filter(item => item.quantity <= item.minStock).length;
    // Stock value: quantity × cost of the products that have a cost
    const stockValue = inventory.reduce((sum, item) => sum + (item.unitCost !== undefined ? item.quantity * item.unitCost : 0), 0);
    const withoutCost = inventory.filter(item => item.unitCost === undefined).length;

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
                currency={currency}
                initialBarcode={formKey === 0 && !editingItem ? newBarcode : undefined}
                onClose={() => setIsFormOpen(false)}
                onSaved={() => {
                    setIsFormOpen(false);
                    router.refresh();
                }}
            />

            <StockImportModal
                key={`import-${importKey}`} // Unlike the form's, so the two siblings' keys never match
                isOpen={isImportOpen}
                departmentId={departmentId}
                onClose={() => setIsImportOpen(false)}
                onImported={() => {
                    refresh();
                    router.refresh();
                }}
            />

            <TransferStockModal
                key={`transfer-${transferKey}`}
                item={transferringItem}
                departments={otherDepartments}
                onClose={() => setTransferringItem(null)}
                onTransferred={() => {
                    setTransferringItem(null);
                    refresh();
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
                    {canManageDepartments ? (
                        <Link
                            href="/admin/departments"
                            className="flex items-center gap-2 text-xs font-bold uppercase text-ink-subtle hover:text-ink transition-colors"
                        >
                            <ArrowLeft size={14} /> {t("backToDepartments")}
                        </Link>
                    ) : <span />}

                    <div className="flex items-center gap-3">
                        <button onClick={() => openForm(null)} className="flex items-center gap-2 px-4 py-2 bg-inverse text-on-inverse rounded-xl text-xs font-bold uppercase hover:bg-accent hover:text-on-accent transition-all">
                            <Plus size={16} /> {t("addProduct")}
                        </button>
                        <button
                            onClick={() => { setImportKey(key => key + 1); setIsImportOpen(true); }}
                            className="flex items-center gap-2 px-4 py-2 bg-card border border-line text-ink-muted rounded-xl text-xs font-bold uppercase hover:bg-subtle transition-all"
                        >
                            <Upload size={16} /> {t("importProducts")}
                        </button>
                        {canSeeReports && (
                            <Link href={`/admin/departments/${departmentId}/report`} className="flex items-center gap-2 px-4 py-2 bg-card border border-line text-ink-muted rounded-xl text-xs font-bold uppercase hover:bg-subtle transition-all">
                                <History size={16} /> {t("viewReport")}
                            </Link>
                        )}
                    </div>
                </div>

                {/* STATS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-card p-5 rounded-3xl border border-line">
                        <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest">{t("totalSku")}</p>
                        <p className="text-2xl font-semibold text-ink">{inventory.length}</p>
                    </div>
                    <div className="bg-card p-5 rounded-3xl border border-line flex justify-between items-center">
                        <div>
                            <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest">{t("lowStock")}</p>
                            <p className="text-2xl font-semibold text-warning">{lowStockCount}</p>
                        </div>
                        {lowStockCount > 0 && <AlertTriangle className="text-warning opacity-20" size={32} />}
                    </div>
                    <div className="bg-card p-5 rounded-3xl border border-line">
                        <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest">{t("estimatedValue")}</p>
                        <p className="text-2xl font-semibold text-accent">{format.number(stockValue, { style: "currency", currency, currencyDisplay: "narrowSymbol" })}</p>
                        {withoutCost > 0 && <p className="text-[11px] text-ink-subtle">{t("withoutCost", { count: withoutCost })}</p>}
                    </div>
                </div>

                {/* SEARCH */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle" size={18} />
                    <input
                        type="text"
                        placeholder={t("searchPlaceholder")}
                        className="w-full bg-card border border-line rounded-full py-4 pl-12 pr-4 text-sm text-ink placeholder:text-ink-subtle outline-none focus:ring-2 focus:ring-accent/30 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <StockTable
                    items={filteredInventory}
                    onQuickMove={quickMove}
                    onEdit={openForm}
                    onDelete={canDelete ? setDeletingItem : undefined}
                    currency={currency}
                    onTransfer={otherDepartments.length > 0 ? (item) => { setTransferKey(key => key + 1); setTransferringItem(item); } : undefined}
                />
            </div>
        </>
    );
}
