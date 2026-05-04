'use client';
import { useSession } from "next-auth/react";
import { useState } from "react";
import { ChevronDown, Building2, Check, RefreshCw } from "lucide-react";

export default function OrgSwitcher({ className, userOrgs }: { className?: string; userOrgs: any[] }) {
    const { data: session, update } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);

    const activeOrg = userOrgs.find(o => o.clientId.toString() === session?.user?.clientId);

    const handleSwitch = async (clientId: string) => {
        if (clientId === session?.user?.clientId) return;

        await fetch('/api/user/update-organization', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ clientId }),
        });

        setIsSwitching(true);
        setIsOpen(false);
        
        // Trigger the JWT update in auth.ts
        await update({ clientId });
        
        // Refresh the page to clear any old state/queries
        window.location.reload();
    };

    console.log(userOrgs);
    

    return (
        <div className={`relative ${className}`}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 px-4 py-2 bg-brand/5 border border-brand/10 rounded-xl hover:bg-brand/10 transition-all"
            >
                <div className="w-8 h-8 bg-brand text-white rounded-lg flex items-center justify-center">
                    <Building2 size={16} />
                </div>
                <div className="text-left hidden md:block">
                    <p className="text-[10px] font-black text-brand/50 uppercase tracking-widest leading-none mb-1">Organizacion</p>
                    <p className="text-sm font-bold text-brand truncate max-w-30">
                        {activeOrg?.name || "Seleccionar..."}
                    </p>
                </div>
                <ChevronDown size={16} className={`text-brand/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-brand/5 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="p-3 border-b border-brand/5 bg-surface/50">
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Mis Organizaciones</p>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        {userOrgs.map((org, index) => (
                            
                            <button
                                key={index}
                                onClick={() => handleSwitch(org.clientId)}
                                className={`w-full flex items-center gap-3 p-3 text-left transition-all hover:bg-surface ${
                                    org.clientId === session?.user?.clientId ? 'bg-brand/5' : ''
                                }`}
                            >
                                <pre>{org}</pre>
                                <div className={`w-2 h-2 rounded-full ${org.status === 'active' ? 'bg-success' : 'bg-status-danger'}`}></div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-brand">{org.clientId}</p>
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
            )}

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