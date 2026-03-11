import { SignOut } from "../auth-components";

export default function Pending() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
                Acceso pendiente
            </h2>
            <p className="text-gray-400">
                Tu cuenta está en revisión. Por favor, espera a que un administrador apruebe tu acceso.
                <br />
                Puede esperar o volver a iniciar sesion mas tarde.
            </p>
            <SignOut />
        </div>
    )
}