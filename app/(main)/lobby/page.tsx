'use client';
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { PlusCircle, Hash, Building2, ArrowRight, LogOut, X, Loader2 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

export default function LobbyPage() {
    const t = useTranslations("lobby");
    const tCommon = useTranslations("common");
    const tErrors = useTranslations("errors");
    const { update, status } = useSession();
    const [joinCode, setJoinCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [companyName, setCompanyName] = useState("");

    const handleJoin = async () => {
        setLoading(true);
        const res = await fetch('/api/user/join', {
            method: 'POST',
            body: JSON.stringify({ code: joinCode })
        });

        if (res.ok) {
            const json = await res.json();
            await update({ clientId: json.clientId });
            window.location.href = "/";
        }
        else if (res.status === 429) alert(tErrors("tooManyAttempts"));
        else alert(t("invalidCode"));
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
            alert(tErrors("createCompanyFailed"));
            setLoading(false);
        }
    };

    // Codes are "ABCD-2345" (older organizations: "ABC-123"). The dash is optional: the server ignores it
    const handleMaskCode = (e: React.ChangeEvent<HTMLInputElement>) => {
        setJoinCode(e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase().slice(0, 9));
    };
    const joinCodeLength = joinCode.replace(/-/g, '').length;

    return status == "loading" ? (<div className="flex items-center justify-center min-h-screen p-6">
      <p className="text-ink-muted">{tCommon("loading")}</p>
    </div>) : (
        <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 relative">

            <div className="absolute top-8 right-8 flex items-center gap-3">
                <ThemeToggle />
                <button onClick={() => signOut({ callbackUrl: "/" })} className="flex items-center gap-2 px-5 py-2.5 bg-card border border-line text-ink-muted rounded-full font-semibold text-xs uppercase tracking-[0.2em] hover:text-danger hover:border-danger/30 transition-all active:scale-95">
                    <LogOut size={16} /> {tCommon("logout")}
                </button>
            </div>

            <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* JOIN CARD */}
                <div className="bg-card p-8 rounded-3xl border border-line flex flex-col h-full">
                    <div className="w-12 h-12 bg-accent/10 text-accent rounded-2xl flex items-center justify-center mb-6">
                        <Hash size={24} />
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight text-ink mb-2">{t("join.title")}</h2>
                    <p className="text-ink-muted mb-8 text-sm">{t("join.description")}</p>
                    <input id="joinCode" name="joinCode" value={joinCode} onChange={handleMaskCode} placeholder="ABCD-2345" className="w-full p-4 text-ink bg-subtle border-2 border-transparent rounded-2xl mb-4 outline-none placeholder:text-ink-subtle focus:border-accent transition-all font-mono text-lg tracking-widest" />
                    <button onClick={handleJoin} disabled={joinCodeLength !== 6 && joinCodeLength !== 8} className="mt-auto w-full bg-accent text-on-accent font-semibold py-4 rounded-full hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 group">
                        {t("join.button")} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

                {/* CREATE CARD */}
                <div className="bg-inverse p-8 rounded-3xl text-on-inverse relative overflow-hidden flex flex-col h-full">
                    <div className="relative z-10 h-full flex flex-col">
                        <div className="w-12 h-12 bg-on-inverse/10 text-accent rounded-2xl flex items-center justify-center mb-6">
                            <PlusCircle size={24} />
                        </div>
                        <h2 className="text-2xl font-semibold tracking-tight mb-2">{t("create.title")}</h2>
                        <p className="text-on-inverse/70 mb-8 text-sm">{t("create.description")}</p>
                        <button onClick={() => setIsModalOpen(true)} className="mt-auto w-full bg-on-inverse text-inverse font-semibold py-4 rounded-full hover:bg-accent hover:text-on-accent transition-all flex items-center justify-center gap-2">
                            <Building2 size={18} /> {t("create.button")}
                        </button>
                    </div>
                </div>
            </div>

            {/* MODAL: CREATE COMPANY */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={() => !loading && setIsModalOpen(false)}></div>

                    <form
                        onSubmit={handleCreate}
                        className="relative w-full max-w-md bg-card rounded-3xl p-10 shadow-2xl border border-line"
                    >
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-6 right-6 text-ink-subtle hover:text-ink transition-colors"
                        >
                            <X size={24} />
                        </button>

                        <div className="w-16 h-16 bg-accent/10 text-accent rounded-2xl flex items-center justify-center mb-6">
                            <Building2 size={32} />
                        </div>

                        <h3 className="text-2xl font-semibold tracking-tight text-ink mb-2">{t("create.modalTitle")}</h3>
                        <p className="text-ink-muted text-sm mb-8">{t("create.modalDescription")}</p>

                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-semibold text-ink-subtle uppercase tracking-[0.2em] ml-1">{t("create.nameLabel")}</label>
                                <input
                                    autoFocus
                                    required
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder={t("create.namePlaceholder")}
                                    className="w-full mt-2 p-4 bg-subtle text-ink font-semibold rounded-2xl border-2 border-transparent placeholder:text-ink-subtle focus:border-accent outline-none transition-all"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={!companyName || loading}
                                className="w-full bg-inverse text-on-inverse font-semibold py-4 rounded-full hover:bg-accent hover:text-on-accent disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : t("create.confirm")}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}