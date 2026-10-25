"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { PERMISSIONS } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { usePlanLimitDialog } from "@/components/admin/PlanLimitDialog";
import { roleLabel } from "@/i18n/labels";
import { Users, Package, Edit3, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type DepartmentRow = { _id: string; name: string; description?: string; clientId?: string };
type Personnel = { _id: string; name: string; isActive: boolean; role: string | null; roleName?: string | null };
type DepartmentForm = { name: string; clientId: string };

interface DepartmentsManagementClientProps {
    departments: DepartmentRow[];
    userClientId?: string;
}

export default function DepartmentsManagementClient({
    departments,
    userClientId
}: DepartmentsManagementClientProps) {
    const t = useTranslations("departments");
    const tCommon = useTranslations("common");
    const tErrors = useTranslations("errors");
    const tRoles = useTranslations("roles");
    // The stock page needs EDIT_STOCK, which a role can lack while managing departments
    const { data: session } = useSession();
    const canEditStock = hasPermission(session, PERMISSIONS.EDIT_STOCK);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<DepartmentRow | null>(null);
    const { handlePlanError, planDialog } = usePlanLimitDialog();

    const [viewingPersonnel, setViewingPersonnel] = useState<Personnel[] | null>(null);
    const [activeDeptName, setActiveDeptName] = useState("");

    const handleViewPersonnel = async (deptId: string, deptName: string) => {
        setActiveDeptName(deptName);
        // Fetch users filtered by this specific department
        const res = await fetch(`/api/admin/departments/personnel?deptId=${deptId}`);
        const data = await res.json();
        setViewingPersonnel(data.users);
    };

    const tableHeaders = [
        { title: t("department") },
        { title: t("info"), hideOnMobile: true },
        { title: tCommon("actions") }
    ];

    // Form State
    const [formData, setFormData] = useState({ name: "", clientId: userClientId || "" });

    const openModal = (dept: DepartmentRow | null = null) => {
        if (dept) {
            setEditingDept(dept);
            setFormData({ name: dept.name, clientId: dept.clientId || "" });
        } else {
            setEditingDept(null);
            setFormData({ name: "", clientId: userClientId || "" });
        }
        setIsModalOpen(true);
    };

    const [isSaving, setIsSaving] = useState(false);
    const router = useRouter();

    const fetchEditingDept = async (deptId: string, formData: DepartmentForm) => {
        return await fetch("/api/admin/departments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: deptId,
                name: formData.name,
                clientId: formData.clientId
            }),
        });
    }

    const fetchInsertDept = async (formData: DepartmentForm) => {
        return await fetch("/api/admin/departments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: formData.name,
                clientId: formData.clientId
            }),
        });
    }

    const handleSave = async () => {
        // Validation
        if (!formData.name || !formData.clientId) {
            alert(tErrors("requiredFields"));
            return;
        }

        setIsSaving(true);
        try {
            const res = editingDept
                ? await fetchEditingDept(editingDept._id, formData)
                : await fetchInsertDept(formData);

            if (res.ok) {
                setIsModalOpen(false);
                setFormData({ name: "", clientId: userClientId || "" });
                router.refresh();
            } else {
                const data = await res.json();
                if (!handlePlanError(data)) alert(data.error || tErrors("saveFailed"));
            }
        } catch {
            alert(tErrors("connection"));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-start justify-between mb-4 sm:flex-row sm:items-center">
                <h1 className="text-2xl font-bold text-ink">{t("title")}</h1>
                <button
                    onClick={() => openModal()}
                    className="bg-inverse text-on-inverse px-5 py-2.5 rounded-full font-bold text-sm hover:bg-accent hover:text-on-accent transition-all"
                >
                    {t("add")}
                </button>
            </div>

            <DataTable headers={tableHeaders}>
                {departments.map((dept) => (
                    <DataTableRow key={dept._id}>
                        <DataTableCell>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-subtle flex items-center justify-center text-accent">
                                    <Building2 size={20} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-ink leading-none">{dept.name}</span>
                                    <span className="text-[10px] text-ink-subtle mt-1 uppercase font-semibold">ID: {dept._id.slice(-6)}</span>
                                </div>
                            </div>
                        </DataTableCell>
                        <DataTableCell className="hidden sm:block">
                            <div className="flex -space-x-2">
                                {/* Placeholder for user avatars if you have them */}
                                <div className="w-7 h-7 rounded-full border-2 border-card bg-subtle flex items-center justify-center text-[10px] font-bold text-ink-muted">
                                    +8
                                </div>
                                <span className="ml-4 text-xs font-medium text-ink-muted flex items-center">{t("members")}</span>
                            </div>
                        </DataTableCell>
                        <DataTableCell>
                            <div className="flex items-center justify-start gap-1">
                                <button
                                    onClick={() => handleViewPersonnel(dept._id, dept.name)}
                                    className="p-2 text-ink-subtle hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
                                >
                                    <Users size={18} />
                                </button>
                                {canEditStock && (
                                    <Link
                                        href={`/admin/departments/${dept._id}/stock`}
                                        className="p-2 text-ink-subtle hover:text-warning hover:bg-warning/10 rounded-lg transition-all"
                                        title={t("reviewStock")}
                                    >
                                        <Package size={18} />
                                    </Link>
                                )}
                                <div className="w-px h-4 bg-subtle mx-2" />
                                <button
                                    onClick={() => openModal(dept)}
                                    className="px-3 py-1.5 bg-subtle text-ink hover:bg-subtle rounded-lg text-xs font-bold flex items-center gap-2 transition-all"
                                >
                                    <Edit3 size={14} />
                                    {tCommon("edit")}
                                </button>
                            </div>
                        </DataTableCell>
                    </DataTableRow>
                ))}
            </DataTable>
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingDept ? t("editTitle") : t("newTitle")}
            >
                <div className="space-y-4">

                    <div>
                        <label className="text-[10px] font-bold uppercase text-ink-subtle block mb-1">{t("nameLabel")}</label>
                        <input
                            type="text"
                            placeholder={t("namePlaceholder")}
                            className="w-full p-3 bg-subtle border rounded-xl text-sm outline-none focus:border-accent"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full bg-inverse text-on-inverse py-4 rounded-2xl font-bold mt-6 hover:bg-accent hover:text-on-accent transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin" />
                                {tCommon("saving")}
                            </>
                        ) : (
                            editingDept ? tCommon("saveChanges") : t("create")
                        )}
                    </button>
                </div>
            </Modal>

            <Modal
                isOpen={viewingPersonnel !== null}
                onClose={() => setViewingPersonnel(null)}
                title={t("personnelTitle", { name: activeDeptName })}
            >
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {viewingPersonnel?.length === 0 && (
                        <p className="text-center py-10 text-ink-subtle text-sm italic">
                            {t("noPersonnel")}
                        </p>
                    )}

                    {viewingPersonnel?.map((user) => (
                        <div key={user._id} className="flex items-center justify-between p-3 rounded-xl bg-subtle border border-transparent hover:border-line transition-all">
                            <div className="flex flex-col">
                                <span className="font-bold text-sm text-ink">{user.name}</span>
                                <span className="text-[10px] text-ink-muted uppercase font-semibold">{user.role && roleLabel(tRoles, user.role, user.roleName)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-success' : 'bg-danger'}`} />
                                <span className="text-[10px] font-bold text-ink-subtle uppercase">
                                    {user.isActive ? tCommon("active") : tCommon("inactive")}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>
            {planDialog}
        </div>
    );
}