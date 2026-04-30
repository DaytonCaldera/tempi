// app/(main)/lobby/page.tsx
'use client';
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { PlusCircle, Hash, Building2, ArrowRight, LogOut, X, Loader2 } from "lucide-react";
import { redirect } from "next/navigation";

export default function LobbyPage() {
    const { data: session, update } = useSession();
    const [joinCode, setJoinCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [companyName, setCompanyName] = useState("");
    
    if (!session?.user) redirect("/");

    const handleJoin = async () => {
        setLoading(true);
        const res = await fetch('/api/user/join', {
            method: 'POST',
            body: JSON.stringify({ code: joinCode })
        });
        if (res.ok) window.location.reload();
        else alert("Código inválido");
        setLoading(false);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!companyName) return;
        
        setLoading(true);
        const res = await fetch('/api/auth/organization/create', { 
            method: 'POST',
            body: JSON.stringify({ companyName }) 
        });

        if (res.ok) {
            const data = await res.json();
            // Force session update to enter the new organization immediately
            await update({ clientId: data.clientId });
            window.location.href = "/dashboard";
        } else {
            alert("Error al crear la empresa");
            setLoading(false);
        }
    };

    const handleMaskCode = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '');
        const x = digits.match(/(\d{0,3})(\d{0,3})/);
        if (x) {
            e.target.value = !x[2] ? x[1] : x[1] + '-' + x[2];
        } else {
            e.target.value = '';
        }
        setJoinCode(e.target.value);
    }

    return (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 relative">
            
            <div className="absolute top-8 right-8">
                <button onClick={() => signOut({ callbackUrl: "/" })} className="flex items-center gap-2 px-5 py-2.5 bg-surface-card border border-brand/10 text-text-muted rounded-xl font-bold text-xs uppercase tracking-widest shadow-sm hover:text-danger hover:border-danger/20 transition-all active:scale-95">
                    <LogOut size={16} /> Cerrar Sesión
                </button>
            </div>

            <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* JOIN CARD */}
                <div className="bg-surface-card p-8 rounded-3xl shadow-xl border border-brand/5 flex flex-col h-full">
                    <div className="w-12 h-12 bg-success/20 text-brand-accent rounded-2xl flex items-center justify-center mb-6">
                        <Hash size={24} />
                    </div>
                    <h2 className="text-2xl font-black text-brand mb-2">Unirse a un Equipo</h2>
                    <p className="text-text-muted mb-8 text-sm">Ingresa el código proporcionado por tu administrador.</p>
                    <input value={joinCode} onChange={handleMaskCode} placeholder="000-000" className="w-full p-4 text-brand bg-surface border-2 border-transparent rounded-xl mb-4 outline-none focus:border-brand-accent transition-all font-mono text-lg tracking-widest" />
                    <button onClick={handleJoin} disabled={!joinCode || loading} className="mt-auto w-full bg-brand-accent text-brand font-bold py-4 rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 group">
                        Unirse <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

                {/* CREATE CARD */}
                <div className="bg-brand p-8 rounded-3xl shadow-xl text-white relative overflow-hidden flex flex-col h-full">
                    <div className="relative z-10 h-full flex flex-col">
                        <div className="w-12 h-12 bg-white/10 text-brand-accent rounded-2xl flex items-center justify-center mb-6">
                            <PlusCircle size={24} />
                        </div>
                        <h2 className="text-2xl font-black mb-2">Empezar de Cero</h2>
                        <p className="text-white/70 mb-8 text-sm">Registra tu empresa para gestionar stock, personal y departamentos.</p>
                        <button onClick={() => setIsModalOpen(true)} className="mt-auto w-full bg-white text-brand font-bold py-4 rounded-xl hover:bg-surface transition-all flex items-center justify-center gap-2 shadow-lg">
                            <Building2 size={18} /> Crear mi Empresa
                        </button>
                    </div>
                </div>
            </div>

            {/* MODAL: CREATE COMPANY */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-brand/40 backdrop-blur-md" onClick={() => !loading && setIsModalOpen(false)}></div>
                    
                    <form 
                        onSubmit={handleCreate}
                        className="relative w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl border border-brand/5"
                    >
                        <button 
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-6 right-6 text-text-muted hover:text-brand transition-colors"
                        >
                            <X size={24} />
                        </button>

                        <div className="w-16 h-16 bg-brand/5 text-brand rounded-2xl flex items-center justify-center mb-6">
                            <Building2 size={32} />
                        </div>

                        <h3 className="text-2xl font-black text-brand mb-2">Nueva Organización</h3>
                        <p className="text-text-muted text-sm mb-8">Define el nombre comercial de tu empresa. Podrás editarlo después.</p>

                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-brand uppercase tracking-widest ml-1">Nombre de la Empresa</label>
                                <input 
                                    autoFocus
                                    required
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="Ej: Eventos del Pacífico"
                                    className="w-full mt-2 p-4 bg-surface text-brand font-bold rounded-2xl border-2 border-transparent focus:border-brand-accent outline-none transition-all"
                                />
                            </div>

                            <button 
                                type="submit"
                                disabled={loading || !companyName}
                                className="w-full bg-brand text-white font-bold py-4 rounded-2xl shadow-xl shadow-brand/20 hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : "Confirmar y Crear"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}