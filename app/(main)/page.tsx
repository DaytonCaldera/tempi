'use client'
import { useSession, signIn, signOut } from "next-auth/react"
// import Lobby from "@/components/main/lobby";
import TestDashboard from "@/components/main/testDashboard";
import { ROLES } from "@/lib/constants";
import Pending from "@/components/main/pending";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import New from "@/components/main/new";
import Runner from "@/components/main/runner";
import Lobby from "@/components/main/lobby";

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter();

  // redirect() from next/navigation isn't supported inside effects, use the router instead
  useEffect(() => {
    if (status !== "authenticated") return;
    const role = session?.user?.role;

    if (session?.user?.isActive === false) {
      router.replace("/unauthorized");
    } else if (!role || role === ROLES.NEW_USER) {
      // No organization yet: create or join one
      router.replace("/lobby");
    } else if (role !== ROLES.PENDING_USER) {
      router.replace("/runner");
    }
  }, [session, status, router])

  return status === "loading" ? (
    <div className="flex items-center justify-center min-h-screen p-6">
      <p className="text-gray-500">Cargando...</p>
    </div>
  ) : (
    <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
      {!session ? (
        /* --- LOBBY STATE (Logged Out) --- */
        <Lobby />
      ) : (
        /* --- DASHBOARD STATE (Logged In) --- */
        session.user?.role === ROLES.PENDING_USER ? (
          <Pending />
        ) : (
          <div className="flex items-center justify-center min-h-screen p-6">
            <p className="text-gray-500">Cargando...</p>
          </div>
        )
      )}
    </div>
  );
}