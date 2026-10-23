'use client'
import { useSession, signIn } from "next-auth/react"
import { SignOut } from "@/components/AuthButtons";

export default function UnauthorizedPage() {
    const { data: session, status } = useSession()

    if (status === "loading") {
        return <p>Loading context...</p>
    }

    if (status === "unauthenticated") {
        return <button onClick={() => signIn("google")}>Sign In</button>
    }

    const isDeactivated = session?.user?.isActive === false;

    return (
        <main className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
                <div className="w-full flex items-center justify-center flex-col max-w-sm p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
                    <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">
                        No esta autorizado para acceder a esta pagina
                    </h2>
                    <br />
                    {isDeactivated ? (
                        <>
                            <p className="text-center text-red-500">
                                Su cuenta ha sido desactivada. Por favor, contacte al administrador para más información.
                            </p>
                            <SignOut />
                        </>
                    ) : (
                        <button className="bg-primary" onClick={() => { window.location.href = "/" }}>
                            Regresar al inicio
                        </button>
                    )}
                </div>
            </div>
        </main>
    );
}
