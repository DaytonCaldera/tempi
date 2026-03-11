'use client'
import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react"
import { SignOut } from "@/components/auth-components";

export default function Page() {
    const { data: session, status } = useSession()
    const [name, setName] = useState("");
    useEffect(() => {
        if (session?.user?.name) {
            setName(session.user.name);
        }
    }, [session]);



    if (status === "loading") {
        return <p>Loading context...</p>
    }

    if (status === "unauthenticated") {
        return <button onClick={() => signIn("google")}>Sign In</button>
    }

    return (
        <main className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            {/* {!session ? ( */}
            <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
                <div className="w-full flex items-center justify-center flex-col max-w-sm p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
                    <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">
                        No esta autorizado para acceder a esta pagina
                    </h2>
                    <br />
                    {session?.user?.isActive === false && (
                        <><p className="text-center text-red-500">
                            Su cuenta ha sido desactivada. Por favor, contacte al administrador para más información.
                        </p>
                        <SignOut /></>
                    )}
                    {session?.user?.isActive !== false && (
                        <button className="bg-primary" onClick={() => { window.location.href = "/" }}>
                            Regresar al inicio
                        </button>
                    )}
                </div>
            </div>
            {/* ) : <></>} */}
        </main>
    );
}