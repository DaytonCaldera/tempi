'use client';
import { useSession } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Building2, Check, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { labelOf } from "@/i18n/labels";
import type { SessionMembership } from "@/types/models";

export default function OrganizationSwitcher({ className, userOrgs }: { className?: string; userOrgs: SessionMembership[] }) {
    const t = useTranslations("nav");
    const tRoles = useTranslations("roles");
    const { data: session, update } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentClientId = session?.user?.clientId;
    const activeOrg = userOrgs.find(o => o.clientId.toString() === currentClientId);

    // Recalculate position whenever dropdown opens
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 8,
                left: rect.left,
                width: 256, // w-64
            });
        }
    }, [isOpen]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (!buttonRef.current?.contains(e.target as Node) && !dropdownRef.current?.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [isOpen]);

    // Saves the choice for the next sign-in, then switches the current session and reloads
    const handleSwitch = async (clientId: string) => {
        if (clientId === currentClientId) return;
        await fetch('/api/user/update-organization', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId }),
        });
        setIsSwitching(true);
        setIsOpen(false);
        await update({ clientId });
        window.location.reload();
    };

    const dropdown = isOpen ? (
        <div
            ref={dropdownRef}
            style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
            className="fixed bg-card rounded-2xl shadow-2xl border border-line overflow-hidden z-200 animate-in fade-in slide-in-from-top-2"
        >
            <div className="p-3 border-b border-line bg-subtle">
                <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-[0.2em]">{t("myOrganizations")}</p>
            </div>
            <div className="max-h-60 overflow-y-auto">
                {userOrgs.map((org, index) => (
                    <button
                        key={index}
                        onClick={() => handleSwitch(org.clientId.toString())}
                        className={`w-full flex items-center gap-3 p-3 text-left transition-all hover:bg-subtle ${
                            org.clientId === currentClientId ? 'bg-accent/10' : ''
                        }`}
                    >
                        <div className={`w-2 h-2 rounded-full ${org.status === 'active' ? 'bg-success' : 'bg-danger'}`}></div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-ink">{org.clientName}</p>
                            <p className="text-[10px] text-ink-subtle uppercase font-semibold tracking-wider">{labelOf(tRoles, org.role)}</p>
                        </div>
                        {org.clientId === currentClientId && (
                            <Check size={16} className="text-accent" />
                        )}
                    </button>
                ))}
            </div>
            <a href="/lobby" className="block p-3 text-center text-xs font-semibold text-ink hover:bg-subtle transition-all border-t border-line">
                {t("joinOrCreate")}
            </a>
        </div>
    ) : null;

    return (
        <div className={`relative ${className}`}>
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 w-full px-3 py-2 bg-card border border-line rounded-xl hover:border-line-strong transition-all"
            >
                <div className="w-8 h-8 shrink-0 bg-inverse text-on-inverse rounded-lg flex items-center justify-center">
                    <Building2 size={16} />
                </div>
                <div className="text-left hidden md:block flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-[0.2em] leading-none mb-1">{t("organization")}</p>
                    <p className="text-sm font-semibold text-ink truncate">
                        {activeOrg?.clientName || t("selectOrganization")}
                    </p>
                </div>
                <ChevronDown size={16} className={`text-ink-subtle transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Portal renders dropdown outside sidebar's overflow context */}
            {typeof window !== "undefined" && createPortal(dropdown, document.body)}

            {isSwitching && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-center justify-center">
                    <div className="bg-card p-6 rounded-3xl shadow-2xl flex items-center gap-4 border border-line">
                        <RefreshCw className="animate-spin text-accent" size={24} />
                        <p className="font-semibold text-ink uppercase tracking-[0.2em] text-xs">{t("switching")}</p>
                    </div>
                </div>
            )}
        </div>
    );
}