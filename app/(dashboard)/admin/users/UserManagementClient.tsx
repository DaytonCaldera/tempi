"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import {
    Shield, Edit3, UserPlus, Ban, Copy, Check
} from "lucide-react";
import { ROLES } from "@/lib/constants";
import { labelOf } from "@/i18n/labels";
import CloseOrganizationCard from "./CloseOrganizationCard";

/** A user flattened with their membership in the current organization. */
export type UserRow = {
    _id: string;
    name: string;
    email: string;
    image?: string;
    clientId?: string;
    role: string;
    isPending: boolean;
    isActive: boolean;
    departments: string[];
};

interface UserManagementClientProps {
    users: UserRow[];
    departments: { _id: string; name: string }[];
    client: { _id: string; code: string; name: string } | null;
    canCloseOrganization: boolean;
    isLastOrganization: boolean;
}

export default function UserManagementClient({ users, departments, client, canCloseOrganization, isLastOrganization }: UserManagementClientProps) {
    const t = useTranslations("users");
    const tCommon = useTranslations("common");
    const tRoles = useTranslations("roles");
    const tErrors = useTranslations("errors");
    const router = useRouter();
    const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
    const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
    const [selectedRole, setSelectedRole] = useState<string>(ROLES.USER);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const clientCode = client?.code || "N/A";

    const copyToClipboard = () => {
        navigator.clipboard.writeText(clientCode.replace('-', '')); // Remove spaces if any
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const openEditModal = (user: UserRow) => {
        setSelectedUser(user);
        setSelectedDepts(user.departments || []);
        // Pending users have a role the dropdown doesn't offer: start from the one it shows
        setSelectedRole(user.isPending || !user.role ? ROLES.USER : user.role);
    };

    const handleConfirm = async () => {
        if (!selectedUser) return;
        setLoading(true);
        const res = await fetch("/api/admin/users/toggle-status", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: selectedUser._id,
                role: selectedRole,
                departments: selectedDepts,
                isActive: true
            }),
        });

        if (res.ok) {
            setSelectedUser(null);
            router.refresh();
        } else {
            const data = await res.json().catch(() => ({}));
            alert(data.error || tErrors("saveFailed"));
        }
        setLoading(false);
    };

    const tableHeaders = [
        { title: t("table.user") },
        { title: t("table.roleAndAreas") },
        { title: t("table.status") },
        { title: tCommon("actions") }
    ];

    return (
        <div className="space-y-8">
            {/* 1. TOP STATS & CODE CARD */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-card p-8 rounded-3xl border border-line flex flex-col justify-center">
                    <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-[0.2em] mb-2">{t("inviteCode")}</p>
                    <div className="flex items-center gap-4">
                        <h2 className="text-4xl font-semibold text-ink tracking-tight">{clientCode}</h2>
                        <button
                            onClick={copyToClipboard}
                            className="p-3 bg-subtle text-ink rounded-2xl hover:bg-subtle transition-all active:scale-95"
                        >
                            {copied ? <Check size={20} className="text-success" /> : <Copy size={20} />}
                        </button>
                    </div>
                    <p className="mt-4 text-xs text-ink-subtle font-medium italic">{t("inviteHint")}</p>
                </div>

                <div className="bg-accent/10 border border-accent/20 p-8 rounded-3xl text-ink flex flex-col justify-center">
                    <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-[0.2em] mb-1">{t("totalStaff")}</p>
                    <p className="text-5xl font-semibold tracking-tight">{users.length}</p>
                    <div className="mt-4 flex items-center gap-2 text-accent text-xs font-bold">
                        <UserPlus size={14} />
                        {t("pendingApproval", { count: users.filter(u => u.isPending).length })}
                    </div>
                </div>
            </div>

            {/* 2. THE TABLE */}
            <div>
                <DataTable headers={tableHeaders}>
                    {users.map((user) => (
                        <DataTableRow key={user._id}>
                            <DataTableCell>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-subtle flex items-center justify-center text-ink font-semibold border border-line text-lg">
                                        {user.name?.charAt(0) || "U"}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-ink leading-tight">{user.name}</span>
                                        <span className="text-[11px] text-ink-subtle font-bold mt-0.5">{user.email}</span>
                                    </div>
                                </div>
                            </DataTableCell>

                            <DataTableCell>
                                <div className="flex flex-col gap-2 min-w-50">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em]">
                                        <Shield size={10} strokeWidth={3} />
                                        {labelOf(tRoles, user.role)}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {user.departments.map(deptId => {
                                            const dept = departments.find(d => d._id === deptId);
                                            return (
                                                <span key={deptId} className="px-3 py-1 bg-subtle text-ink border border-line rounded-lg text-[10px] font-bold">
                                                    {dept?.name || t("defaultArea")}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            </DataTableCell>

                            <DataTableCell>
                                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${user.isActive && !user.isPending ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${user.isActive && !user.isPending ? 'bg-success' : 'bg-warning'}`} />
                                    <span className="text-[10px] font-semibold uppercase tracking-widest">
                                        {user.isPending ? tCommon("pending") : user.isActive ? tCommon("active") : tCommon("inactive")}
                                    </span>
                                </div>
                            </DataTableCell>

                            <DataTableCell>
                                <div className="flex items-center justify-end gap-2">
                                    {user.isPending ? (
                                        <button
                                            onClick={() => openEditModal(user)}
                                            className="px-4 py-2 bg-accent text-on-accent rounded-xl text-xs font-semibold uppercase hover:brightness-110 transition-all"
                                        >
                                            {t("approve")}
                                        </button>
                                    ) : (
                                        <>
                                            <button onClick={() => openEditModal(user)} className="p-2.5 text-ink-subtle hover:text-ink hover:bg-subtle rounded-xl transition-all">
                                                <Edit3 size={18} />
                                            </button>
                                            <button className="p-2.5 text-ink-subtle hover:text-danger hover:bg-danger/5 rounded-xl transition-all">
                                                <Ban size={18} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </DataTableCell>
                        </DataTableRow>
                    ))}
                </DataTable>
            </div>

            {/* 3. DANGER ZONE */}
            {canCloseOrganization && client && <CloseOrganizationCard organizationName={client.name} isLastOrganization={isLastOrganization} />}

            {/* 4. THE MODAL */}
            <Modal isOpen={!!selectedUser} onClose={() => setSelectedUser(null)} title={t("configureTitle")}
                footer={
                    <button
                        onClick={handleConfirm}
                        disabled={loading || selectedDepts.length === 0}
                        className="w-full bg-inverse text-on-inverse py-5 rounded-3xl font-semibold text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                    >
                        {loading ? t("processing") : selectedUser?.isPending ? t("activateMember") : tCommon("saveChanges")}
                    </button>
                }
            >
                <div className="space-y-8 py-4">
                    <div className="p-6 bg-subtle rounded-3xl border border-line text-center">
                        <div className="w-16 h-16 bg-inverse text-on-inverse rounded-3xl flex items-center justify-center text-2xl font-semibold mx-auto mb-4">
                            {selectedUser?.name?.charAt(0)}
                        </div>
                        <p className="text-xl font-semibold text-ink tracking-tight">{selectedUser?.name}</p>
                        <p className="text-xs text-ink-subtle font-bold uppercase tracking-widest">{selectedUser?.email}</p>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-semibold text-ink-subtle uppercase tracking-[0.2em] ml-2">{t("accessRole")}</label>
                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="w-full bg-subtle border border-line rounded-2xl px-5 py-4 text-sm font-bold text-ink focus:ring-2 ring-accent/30 outline-none appearance-none"
                        >
                            <option value={ROLES.USER}>{tRoles(ROLES.USER)}</option>
                            <option value={ROLES.ADMIN}>{tRoles(ROLES.ADMIN)}</option>
                        </select>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-semibold text-ink-subtle uppercase tracking-[0.2em] ml-2">{t("areaAssignment")}</label>
                        <div className="grid grid-cols-2 gap-3">
                            {departments.map((dept) => {
                                const isSelected = selectedDepts.includes(dept._id);
                                return (
                                    <button
                                        key={dept._id}
                                        onClick={() => setSelectedDepts(p => p.includes(dept._id) ? p.filter(id => id !== dept._id) : [...p, dept._id])}
                                        className={`p-4 rounded-2xl border text-xs font-semibold transition-all text-left flex justify-between items-center ${isSelected ? 'bg-inverse text-on-inverse border-inverse' : 'bg-card text-ink-subtle border-line hover:border-line-strong'}`}
                                    >
                                        {dept.name}
                                        {isSelected && <Check size={14} className="text-accent" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </Modal>
        </div>
    );
}