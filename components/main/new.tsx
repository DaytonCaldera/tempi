import { useState } from "react";
import { SignOut } from "../auth-components";
import Button from "../ui/button";
import { useSession } from "next-auth/react";
import { ROLES } from "@/lib/constants";

export default function New() {

    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [verified, setVerified] = useState(false);
    const { update } = useSession();
    const [companyName, setCompanyName] = useState("");
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<"select" | "join" | "create">("select");


    const handleCreateOrg = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/auth/organization/create", {
                method: "POST",
                body: JSON.stringify({ companyName }),
                headers: { "Content-Type": "application/json" }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            // Update session to reflect new role and clientId
            await update({ 
                role: ROLES.ADMIN, 
                clientId: data.clientId, 
                clientCode: data.clientCode 
            });
            window.location.reload(); // Force refresh to trigger dashboard redirect
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleJoinSubmit = async () => {
        if (!code) return;

        try {
            const res = await fetch("/api/auth/verify-code", {
                method: "POST",
                body: JSON.stringify({ code }),
                headers: { "Content-Type": "application/json" }
            });

            if (!res.ok) {
                const error = await res.json();
                setError(error.message);
                return;
            }
            setError("");
            setVerified(true);
        } catch (err) {
            setError("Error verifying code");
        }
    }

    const handleMaskCode = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '');
        const x = digits.match(/(\d{0,3})(\d{0,3})/);
        
        if (x) {
            e.target.value = !x[2] ? x[1] : x[1] + '-' + x[2];
        } else {
            e.target.value = '';
        }
        
        setCode(e.target.value);
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center max-w-md mx-auto">
            <h2 className="text-3xl font-bold bg-linear-to-r from-white to-purple-400 bg-clip-text text-transparent mb-4">
                Bienvenido a TEMPI
            </h2>

            {view === "select" && (
                <div className="space-y-4 w-full">
                    <p className="text-gray-400 mb-8">¿Cómo deseas comenzar?</p>
                    <Button variant="primary" className="w-full py-6" onClick={() => setView("create")}>
                        Crear Nueva Organización
                    </Button>
                    <Button variant="secondary" className="w-full py-6" onClick={() => setView("join")}>
                        Unirme a una existente
                    </Button>
                </div>
            )}

            {view === "create" && (
                <div className="space-y-4 w-full">
                    <p className="text-gray-400">Ingresa el nombre de tu empresa o equipo</p>
                    <input 
                        type="text" 
                        placeholder="Nombre de la Empresa" 
                        className="w-full bg-gray-800 text-white p-3 rounded-xl border border-gray-700 outline-none focus:ring-2 ring-purple-500"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                    />
                    <Button variant="primary" className="w-full" onClick={handleCreateOrg} disabled={loading}>
                        {loading ? "Creando..." : "Empezar ahora (Plan Gratis)"}
                    </Button>
                    <button onClick={() => setView("select")} className="text-xs text-gray-500 uppercase font-bold tracking-widest">Volver</button>
                </div>
            )}

            {view === "join" && (
                <div className="space-y-4 w-full">
                    <p className="text-gray-400">Ingresa el código proporcionado por tu administrador</p>
                    <input 
                        type="text" 
                        onChange={handleMaskCode} 
                        placeholder="Ej. 000-000" 
                        className="w-full bg-gray-800 text-white p-3 rounded-xl border border-gray-700 outline-none focus:ring-2 ring-purple-500"
                    />
                    <Button variant="primary" className="w-full" onClick={handleJoinSubmit}>
                        Verificar Código
                    </Button>
                    <button onClick={() => setView("select")} className="text-xs text-gray-500 uppercase font-bold tracking-widest">Volver</button>
                </div>
            )}

            {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
            <div className="mt-12">
                <SignOut variant="secondary" />
            </div>
        </div>
    );
}