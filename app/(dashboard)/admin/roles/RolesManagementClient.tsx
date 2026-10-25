"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Edit3, Lock, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ROLE_NAME_MAX_LENGTH, ROLE_PERMISSIONS } from "@/lib/constants";
import { roleLabel } from "@/i18n/labels";

/** A role as the roles page shows it. Built-in ones use their slug as _id and are labeled with the "roles" messages. */
export type RoleRow = {
    _id: string;
    slug: string;
    name: string | null;
    builtIn: boolean;
    /** Whether the user may edit or delete it: not built-in, and no permission the user lacks */
    editable: boolean;
    permissions: Record<string, boolean>;
    members: number;
};

type Form = { name: string; permissions: Record<string, boolean> };
const emptyForm = (): Form => ({ name: "", permissions: Object.fromEntries(ROLE_PERMISSIONS.map(p => [p, false])) });

/**
 * The organization's roles: the built-in ones (read-only) and its own, which members with manage_roles create,
 * edit and delete. Permissions the user lacks can't be ticked (the API checks it too).
 */
export default function RolesManagementClient({ roles, ownPermissions }: { roles: RoleRow[]; ownPermissions: Record<string, boolean> }) {
    const t = useTranslations("rolesAdmin");
    const tPermissions = useTranslations("permissions");
    const tRoles = useTranslations("roles");
    const tCommon = useTranslations("common");
    const tErrors = useTranslations("errors");
    const router = useRouter();

    const [editing, setEditing] = useState<RoleRow | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [form, setForm] = useState<Form>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<RoleRow | null>(null);

    const openForm = (role: RoleRow | null) => {
        setEditing(role);
        setForm(role ? { name: role.name ?? "", permissions: { ...role.permissions } } : emptyForm());
        setIsOpen(true);
    };

    const toggle = (permission: string) =>
        setForm(f => ({ ...f, permissions: { ...f.permissions, [permission]: !f.permissions[permission] } }));

    const save = async () => {
        if (!form.name.trim()) return alert(tErrors("roleNameRequired"));
        setSaving(true);
        try {
            const res = await fetch(editing ? `/api/admin/roles/${editing._id}` : "/api/admin/roles", {
                method: editing ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                setIsOpen(false);
                router.refresh();
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data.error || tErrors("saveFailed"));
            }
        } catch {
            alert(tErrors("connection"));
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!deleting) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/roles/${deleting._id}`, { method: "DELETE" });
            if (res.ok) {
                setDeleting(null);
                router.refresh();
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data.error || tErrors("saveFailed"));
            }
        } catch {
            alert(tErrors("connection"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-semibold text-ink">{t("title")}</h1>
                    <p className="text-sm text-ink-muted mt-1 max-w-2xl">{t("subtitle")}</p>
                </div>
                <button
                    onClick={() => openForm(null)}
                    className="flex items-center gap-2 px-5 py-3 bg-accent text-on-accent rounded-2xl text-sm font-semibold hover:brightness-110 transition-all shrink-0"
                >
                    <Plus size={16} /> {t("create")}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {roles.map(role => (
                    <div key={role._id} className="bg-card border border-line rounded-3xl p-6 flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={16} className="text-accent shrink-0" />
                                    <h2 className="font-semibold text-ink truncate">{roleLabel(tRoles, role.slug, role.name)}</h2>
                                </div>
                                <p className="mt-1 flex items-center gap-3 text-xs text-ink-subtle">
                                    <span className="flex items-center gap-1"><Users size={12} />{t("members", { count: role.members })}</span>
                                    {role.builtIn && <span className="flex items-center gap-1"><Lock size={12} />{t("builtIn")}</span>}
                                    {!role.builtIn && !role.editable && <span className="flex items-center gap-1"><Lock size={12} />{t("aboveYours")}</span>}
                                </p>
                            </div>
                            {role.editable && (
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => openForm(role)}
                                        aria-label={t("edit", { role: role.name ?? "" })}
                                        title={t("edit", { role: role.name ?? "" })}
                                        className="p-2.5 text-ink-subtle hover:text-ink hover:bg-subtle rounded-xl transition-all"
                                    >
                                        <Edit3 size={16} />
                                    </button>
                                    <button
                                        onClick={() => setDeleting(role)}
                                        aria-label={t("delete", { role: role.name ?? "" })}
                                        title={t("delete", { role: role.name ?? "" })}
                                        className="p-2.5 text-ink-subtle hover:text-danger hover:bg-danger/5 rounded-xl transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                        <ul className="flex flex-wrap gap-1.5">
                            {ROLE_PERMISSIONS.filter(p => role.permissions[p]).map(p => (
                                <li key={p} className="px-2.5 py-1 bg-subtle border border-line rounded-lg text-[11px] font-semibold text-ink">
                                    {tPermissions(`${p}.label`)}
                                </li>
                            ))}
                            {!ROLE_PERMISSIONS.some(p => role.permissions[p]) && <li className="text-xs text-ink-subtle">{t("noPermissions")}</li>}
                        </ul>
                    </div>
                ))}
            </div>

            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={editing ? t("editTitle") : t("createTitle")}
                footer={
                    <button
                        onClick={save}
                        disabled={saving}
                        className="w-full bg-inverse text-on-inverse py-4 rounded-3xl font-semibold text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                    >
                        {saving ? t("saving") : tCommon("saveChanges")}
                    </button>
                }
            >
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label htmlFor="role-name" className="text-[10px] font-semibold text-ink-subtle uppercase tracking-[0.2em] ml-2">{t("name")}</label>
                        <input
                            id="role-name"
                            value={form.name}
                            maxLength={ROLE_NAME_MAX_LENGTH}
                            placeholder={t("namePlaceholder")}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full bg-subtle border border-line rounded-2xl px-5 py-4 text-sm font-semibold text-ink placeholder:text-ink-subtle focus:ring-2 ring-accent/30 outline-none"
                        />
                    </div>
                    <fieldset className="space-y-2">
                        <legend className="text-[10px] font-semibold text-ink-subtle uppercase tracking-[0.2em] ml-2 mb-2">{t("permissions")}</legend>
                        {ROLE_PERMISSIONS.map(p => {
                            // Nobody gives a permission they don't have
                            const locked = !ownPermissions[p];
                            const checked = !!form.permissions[p];
                            return (
                                <button
                                    key={p}
                                    type="button"
                                    role="checkbox"
                                    aria-checked={checked}
                                    disabled={locked}
                                    onClick={() => toggle(p)}
                                    className={`w-full flex items-start gap-3 p-4 rounded-2xl border text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${checked ? "border-accent bg-accent/10" : "border-line bg-card hover:border-line-strong"}`}
                                >
                                    <span className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border flex items-center justify-center ${checked ? "bg-accent border-accent text-on-accent" : "border-line-strong"}`}>
                                        {checked && <Check size={12} strokeWidth={3} />}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold text-ink">{tPermissions(`${p}.label`)}</span>
                                        <span className="block text-xs text-ink-muted mt-0.5">{locked ? t("lockedPermission") : tPermissions(`${p}.description`)}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </fieldset>
                </div>
            </Modal>

            <Modal isOpen={!!deleting} onClose={() => setDeleting(null)} title={t("deleteTitle")}
                footer={
                    <button
                        onClick={remove}
                        disabled={saving || !!deleting?.members}
                        className="w-full bg-danger text-canvas py-4 rounded-3xl font-semibold text-sm uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
                    >
                        {saving ? t("saving") : t("confirmDelete")}
                    </button>
                }
            >
                <p className="text-sm text-ink-muted">
                    {deleting?.members
                        ? t("deleteInUse", { role: deleting.name ?? "", count: deleting.members })
                        : t("deleteConfirm", { role: deleting?.name ?? "" })}
                </p>
            </Modal>
        </div>
    );
}
