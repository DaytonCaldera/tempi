'use client';
import { useSession } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Building2, Check, RefreshCw } from "lucide-react";

export default function OrgSwitcher({ className, userOrgs }: { className?: string; userOrgs: any[] }) {
    
    const { data: session, update } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const activeOrg = userOrgs.find(o => o.clientId.toString() === session?.user?.clientId);

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

    const handleSwitch = async (clientId: any) => {
        console.log(clientId, session?.user?.clientId?.toString());
        
        if (clientId === session?.user?.clientId?.toString()) return;
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
            className="fixed bg-white rounded-2xl shadow-2xl border border-brand/5 overflow-hidden z-200 animate-in fade-in slide-in-from-top-2"
        >
            <div className="p-3 border-b border-brand/5 bg-surface/50">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Mis Organizaciones</p>
            </div>
            <div className="max-h-60 overflow-y-auto">
                {userOrgs.map((org, index) => (
                    <button
                        key={index}
                        onClick={() => handleSwitch(org.clientId.toString())}
                        className={`w-full flex items-center gap-3 p-3 text-left transition-all hover:bg-surface ${
                            org.clientId === session?.user?.clientId ? 'bg-brand/5' : ''
                        }`}
                    >
                        <div className={`w-2 h-2 rounded-full ${org.status === 'active' ? 'bg-success' : 'bg-status-danger'}`}></div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-brand">{org.clientName}</p>
                            <p className="text-[10px] text-text-muted uppercase font-bold">{org.role}</p>
                        </div>
                        {org.clientId === session?.user?.clientId && (
                            <Check size={16} className="text-brand-accent" />
                        )}
                    </button>
                ))}
            </div>
            <a href="/lobby" className="block p-3 text-center text-xs font-bold text-brand hover:bg-brand/5 transition-all border-t border-brand/5">
                + Unirse o Crear Nueva
            </a>
        </div>
    ) : null;

    return (
        <div className={`relative ${className}`}>
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 px-4 py-2 bg-brand/5 border border-brand/10 rounded-xl hover:bg-brand/10 transition-all"
            >
                <div className="w-8 h-8 bg-brand text-white rounded-lg flex items-center justify-center">
                    <Building2 size={16} />
                </div>
                <div className="text-left hidden md:block">
                    <p className="text-[10px] font-black text-white/50 uppercase tracking-widest leading-none mb-1">Organizacion</p>
                    <p className="text-sm font-bold text-white truncate max-w-30">
                        {activeOrg?.clientName || "Seleccionar..."}
                    </p>
                </div>
                <ChevronDown size={16} className={`text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Portal renders dropdown outside sidebar's overflow context */}
            {typeof window !== "undefined" && createPortal(dropdown, document.body)}

            {isSwitching && (
                <div className="fixed inset-0 bg-brand/10 backdrop-blur-sm z-[60] flex items-center justify-center">
                    <div className="bg-white p-6 rounded-3xl shadow-2xl flex items-center gap-4 border border-brand/10">
                        <RefreshCw className="animate-spin text-brand" size={24} />
                        <p className="font-bold text-brand uppercase tracking-widest text-xs">Cambiando Contexto...</p>
                    </div>
                </div>
            )}
        </div>
    );
}