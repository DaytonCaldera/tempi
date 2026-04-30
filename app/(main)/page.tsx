'use client'
import { useSession, signIn, signOut } from "next-auth/react"
// import Lobby from "@/components/main/lobby";
import TestDashboard from "@/components/main/testDashboard";
import { ROLES } from "@/lib/constants";
import Pending from "@/components/main/pending";
import { useEffect } from "react";
import { redirect } from "next/navigation";
import New from "@/components/main/new";
import Runner from "@/components/main/runner";
import Lobby from "@/components/main/lobby";

export default function Home() {
  const { data: session, status } = useSession()


  const checkUserStatus = () => {
    
  }

  useEffect(() => {
    
    if (session?.user?.isActive === false) {
      redirect("/unauthorized");
    }
    console.log(status, session?.user);

    if (status === "authenticated" && ![ROLES.PENDING_USER, ROLES.NEW_USER].includes(session?.user?.role)) {
      redirect("/runner")
    }
  }, [session, status])

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
        ) : session.user?.role === ROLES.NEW_USER ? (
          redirect("/lobby")
        ) : (
          <div className="flex items-center justify-center min-h-screen p-6">
            <p className="text-gray-500">Cargando...</p>
          </div>
        )
      )}
    </div>
  );
}