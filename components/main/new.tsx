import { useState } from "react";
import { SignOut } from "../auth-components";
import Button from "../ui/button";
import { useSession } from "next-auth/react";

export default function New() {

    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [verified, setVerified] = useState(false);
    const { update } = useSession();

    const handleSubmit = async () => {
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
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
                Acceso pendiente
            </h2>
            <p className="text-gray-400">
                Ingrese el codigo de la cuenta general proporcionada por el administrador. Luego cierre y vuelva a iniciar sesion.
                <br />
                Si no tiene el codigo, contacte al administrador.
            </p>
            <input hidden={verified} type="text" onChange={handleMaskCode} placeholder="Ej. 000-000" className="w-75 bg-gray-800 text-gray-400 placeholder:text-gray-500 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 p-2 rounded my-4" />
            <Button
                hidden={verified}
                className="w-75 p-0"
                variant="primary"
                onClick={handleSubmit}
            >
                Ingresar codigo
            </Button>
            <p className={`${(error !== '') ? '' : 'hidden'} text-sm text-red-400 w-75`}>{error}</p>


            <SignOut variant="secondary" />
        </div>
    )
}