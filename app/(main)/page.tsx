'use client'
import { useSession, signIn, signOut } from "next-auth/react"
import { SignIn, SignOut } from "@/components/auth-components"; // We'll create this
import TaskTable from "@/components/TaskTable"; // We'll mock this
import Lobby from "@/components/main/lobby";
import TestDashboard from "@/components/main/testDashboard";
import { ROLES } from "@/lib/constants";
import Pending from "@/components/main/pending";

export default function Home() {
  const { data: session, status } = useSession()


  return status === "loading" ? (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-500">Cargando...</p>
    </div>
  ) : (
    <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
      {!session ? (
        /* --- LOBBY STATE (Logged Out) --- */
        <Lobby />
      ) : (
        /* --- DASHBOARD STATE (Logged In) --- */
        session.user?.role === ROLES.SUPERADMIN ? (
          <Pending />
        ) : (
          <TestDashboard session={session} />
        )
      )}
    </div>
  );
}