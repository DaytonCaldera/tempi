"use client";
import { useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Building2, Check, LogOut, User } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import ThemeToggle from "@/components/ThemeToggle";
import TimeZoneSetting from "./TimeZoneSetting";
import { localeNames, locales } from "@/i18n/config";
import { useLocaleSwitcher } from "@/i18n/useLocaleSwitcher";
import { roleLabel } from "@/i18n/labels";
import type { SessionMembership, StartPage } from "@/types/models";

interface AccountClientProps {
    /** Open organizations the user owns: they can't leave them, and they block deleting the account. */
    ownedOrganizations: { _id: string; name: string }[];
    justClosedOrganization: boolean;
    canDeleteAccount: boolean;
    /** Runners (users with assigned areas) choose whether they land on the dashboard or the runner page. */
    canChooseStartPage: boolean;
}

const START_PAGES: StartPage[] = ["dashboard", "runner"];

const card = "bg-card p-8 rounded-3xl border border-line";
const eyebrow = "text-[10px] font-semibold text-ink-subtle uppercase tracking-[0.2em] mb-4";

export default function AccountClient({ ownedOrganizations, justClosedOrganization, canDeleteAccount, canChooseStartPage }: AccountClientProps) {
    const t = useTranslations("account");
    const tNav = useTranslations("nav");
    const tRoles = useTranslations("roles");
    const tErrors = useTranslations("errors");
    const { data: session, update } = useSession();
    const { locale, switchLocale } = useLocaleSwitcher();

    const [leaving, setLeaving] = useState<SessionMembership | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [confirmEmail, setConfirmEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const email = session?.user?.email || "";
    const organizations = session?.user?.organizations || [];
    const ownedIds = new Set(ownedOrganizations.map(o => o._id));

    const closeModals = () => {
        setLeaving(null);
        setIsDeleteOpen(false);
        setConfirmEmail("");
        setError("");
    };

    /** Re-resolves the session in that organization (or none) and reloads, so every component reads it. */
    const enterOrganization = async (clientId: string | null) => {
        await update({ clientId: clientId ?? "none" });
        window.location.assign(clientId ? "/" : "/account");
    };

    // Same as the sidebar switcher: saves the choice for the next sign-in, then switches the session
    const handleSwitch = async (clientId: string) => {
        setLoading(true);
        await fetch("/api/user/update-organization", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId }),
        });
        await enterOrganization(clientId);
    };

    const handleStartPage = async (startPage: StartPage) => {
        setLoading(true);
        await fetch("/api/user/start-page", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startPage }),
        });
        await update(); // Re-reads the user, so the session shows the new choice
        setLoading(false);
    };

    const handleLeave = async () => {
        if (!leaving) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/user/leave-organization", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId: leaving.clientId }),
            });
            if (!res.ok) {
                setError((await res.json()).error || tErrors("serverError"));
                setLoading(false);
                return;
            }
            const { nextClientId } = await res.json() as { nextClientId: string | null };
            // Leaving another organization keeps the current one
            const stays = leaving.clientId !== session?.user?.clientId ? session?.user?.clientId ?? null : null;
            await enterOrganization(stays ?? nextClientId);
        } catch {
            setError(tErrors("connection"));
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/user/account", { method: "DELETE" });
            if (!res.ok) {
                setError((await res.json()).error || tErrors("serverError"));
                setLoading(false);
                return;
            }
            await signOut({ redirect: true, callbackUrl: "/" });
        } catch {
            setError(tErrors("connection"));
            setLoading(false);
        }
    };

    const dangerButton = "w-full bg-danger text-canvas py-4 rounded-3xl font-semibold text-sm uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-40";

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="mb-4 text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>

            {justClosedOrganization && organizations.length === 0 && (
                <div className="p-6 rounded-3xl border border-accent/30 bg-accent/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold text-ink">{t("closedBanner.title")}</p>
                        <p className="text-sm text-ink-muted mt-1">{t("closedBanner.description")}</p>
                    </div>
                    <Link href="/lobby" className="shrink-0 px-5 py-3 bg-accent text-on-accent rounded-2xl text-xs font-semibold uppercase tracking-widest text-center hover:brightness-110 transition-all">
                        {t("closedBanner.cta")}
                    </Link>
                </div>
            )}

            {/* PROFILE */}
            <section className={card}>
                <p className={eyebrow}>{t("profile.title")}</p>
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 shrink-0 bg-subtle border border-line rounded-2xl flex items-center justify-center text-ink-muted overflow-hidden">
                        {session?.user?.image
                            ? <img src={session.user.image} alt={tNav("avatar")} className="w-full h-full object-cover" />
                            : <User size={28} />}
                    </div>
                    <div className="min-w-0">
                        <p className="text-lg font-semibold text-ink truncate">{session?.user?.name}</p>
                        <p className="text-sm text-ink-muted truncate">{email}</p>
                    </div>
                </div>
                <p className="text-xs text-ink-subtle mt-4">{t("profile.google")}</p>
            </section>

            {/* PREFERENCES */}
            <section className={card}>
                <p className={eyebrow}>{t("preferences.title")}</p>
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-semibold text-ink">{t("preferences.language")}</p>
                        <div role="radiogroup" aria-label={t("preferences.language")} className="inline-flex gap-0.5 rounded-full border border-line bg-card p-1">
                            {locales.map(code => (
                                <button
                                    key={code}
                                    role="radio"
                                    aria-checked={locale === code}
                                    onClick={() => switchLocale(code)}
                                    className={`px-3 h-7 rounded-full text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${locale === code ? "bg-subtle text-ink" : "text-ink-subtle hover:text-ink"}`}
                                >
                                    {localeNames[code]}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-semibold text-ink">{t("preferences.theme")}</p>
                        <ThemeToggle />
                    </div>
                    <TimeZoneSetting />
                    {canChooseStartPage && (
                        <div className="flex items-center justify-between gap-4">
                            <p className="text-sm font-semibold text-ink">{t("preferences.startPage")}</p>
                            <div role="radiogroup" aria-label={t("preferences.startPage")} className="inline-flex gap-0.5 rounded-full border border-line bg-card p-1">
                                {START_PAGES.map(page => {
                                    const isSelected = (session?.user?.startPage ?? "dashboard") === page;
                                    return (
                                        <button
                                            key={page}
                                            role="radio"
                                            aria-checked={isSelected}
                                            onClick={() => !isSelected && handleStartPage(page)}
                                            disabled={loading}
                                            className={`px-3 h-7 rounded-full text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 ${isSelected ? "bg-subtle text-ink" : "text-ink-subtle hover:text-ink"}`}
                                        >
                                            {tNav(page)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* ORGANIZATIONS */}
            <section className={card}>
                <p className={eyebrow}>{t("organizations.title")}</p>
                {organizations.length === 0 ? (
                    <p className="text-sm text-ink-muted">{t("organizations.empty")}</p>
                ) : (
                    <ul className="divide-y divide-line">
                        {organizations.map(org => {
                            const isCurrent = org.clientId === session?.user?.clientId;
                            const isOwner = ownedIds.has(org.clientId);
                            return (
                                <li key={org.clientId} className="flex items-center gap-3 py-3">
                                    <div className="w-9 h-9 shrink-0 bg-subtle rounded-xl flex items-center justify-center text-ink-muted">
                                        <Building2 size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-ink truncate">{org.clientName || tNav("unnamedOrganization")}</p>
                                        <p className="text-[10px] text-ink-subtle uppercase font-semibold tracking-wider">
                                            {roleLabel(tRoles, org.role, org.roleName)}{isOwner && ` · ${t("organizations.owner")}`}
                                        </p>
                                    </div>
                                    {isCurrent ? (
                                        <span className="flex items-center gap-1 text-xs font-semibold text-accent"><Check size={14} />{t("organizations.current")}</span>
                                    ) : org.status === "active" && (
                                        <button onClick={() => handleSwitch(org.clientId)} disabled={loading} className="px-3 py-2 rounded-xl text-xs font-semibold text-ink border border-line hover:border-line-strong transition-all disabled:opacity-40">
                                            {t("organizations.switch")}
                                        </button>
                                    )}
                                    {!isOwner && (
                                        <button onClick={() => setLeaving(org)} disabled={loading} title={t("organizations.leave")} className="p-2 rounded-xl text-ink-subtle hover:text-danger hover:bg-danger/10 transition-all disabled:opacity-40">
                                            <LogOut size={16} />
                                            <span className="sr-only">{t("organizations.leave")}</span>
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
                <Link href="/lobby" className="block mt-4 text-center p-3 rounded-2xl border border-dashed border-line text-xs font-semibold text-ink hover:bg-subtle transition-all">
                    {t("organizations.joinOrCreate")}
                </Link>
            </section>

            {/* DANGER ZONE */}
            {canDeleteAccount && (
                <section className="bg-card p-8 rounded-3xl border border-danger/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <p className="text-[10px] font-semibold text-danger uppercase tracking-[0.2em] mb-2">{t("delete.title")}</p>
                        <p className="text-sm text-ink-muted font-medium max-w-xl">
                            {ownedOrganizations.length > 0
                                ? t("delete.blocked", { names: ownedOrganizations.map(o => o.name).join(", ") })
                                : t("delete.description")}
                        </p>
                    </div>
                    <button
                        onClick={() => setIsDeleteOpen(true)}
                        disabled={ownedOrganizations.length > 0}
                        className="shrink-0 px-6 py-3 border border-danger/30 text-danger rounded-2xl text-xs font-semibold uppercase tracking-widest hover:bg-danger/5 transition-all disabled:opacity-40 disabled:pointer-events-none"
                    >
                        {t("delete.button")}
                    </button>
                </section>
            )}

            <Modal isOpen={!!leaving} onClose={closeModals} title={t("organizations.leaveTitle")}
                footer={
                    <button onClick={handleLeave} disabled={loading} className={dangerButton}>
                        {loading ? t("organizations.leaving") : t("organizations.leaveConfirm", { name: leaving?.clientName || "" })}
                    </button>
                }
            >
                <div className="space-y-4">
                    <div className="flex gap-3 p-4 bg-danger/5 rounded-2xl text-danger">
                        <AlertTriangle size={20} className="shrink-0" />
                        <p className="text-sm font-medium">{t("organizations.leaveWarning", { name: leaving?.clientName || "" })}</p>
                    </div>
                    {error && <p className="text-sm font-bold text-danger">{error}</p>}
                </div>
            </Modal>

            <Modal isOpen={isDeleteOpen} onClose={closeModals} title={t("delete.title")}
                footer={
                    <button onClick={handleDelete} disabled={loading || confirmEmail.trim().toLowerCase() !== email.toLowerCase()} className={dangerButton}>
                        {loading ? t("delete.deleting") : t("delete.confirm")}
                    </button>
                }
            >
                <div className="space-y-6">
                    <div className="flex gap-3 p-4 bg-danger/5 rounded-2xl text-danger">
                        <AlertTriangle size={20} className="shrink-0" />
                        <p className="text-sm font-medium">{t("delete.warning")}</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-ink-muted">{t("delete.confirmLabel", { email })}</label>
                        <input
                            value={confirmEmail}
                            onChange={(e) => setConfirmEmail(e.target.value)}
                            autoComplete="off"
                            className="w-full bg-subtle border border-line rounded-2xl px-5 py-4 text-sm font-bold text-ink focus:ring-2 ring-danger/20 outline-none"
                        />
                    </div>
                    {error && <p className="text-sm font-bold text-danger">{error}</p>}
                </div>
            </Modal>
        </div>
    );
}
