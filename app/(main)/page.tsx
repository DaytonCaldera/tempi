'use client'
import { useSession, signIn, signOut } from "next-auth/react"
import Lobby from "@/components/main/lobby";
import TestDashboard from "@/components/main/testDashboard";
import { ROLES } from "@/lib/constants";
import Pending from "@/components/main/pending";
import { useEffect } from "react";
import { redirect } from "next/navigation";
import New from "@/components/main/new";

export default function Home() {
  const { data: session, status } = useSession()


  useEffect(() => {
    if (status === "authenticated" && ![ROLES.PENDING_USER, ROLES.NEW_USER].includes(session?.user?.role)) {
      redirect("/dashboard")
    }
  },[status])

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
        session.user?.role === ROLES.PENDING_USER ? (
          <Pending />
        ) : session.user?.role === ROLES.NEW_USER ? (
          <New />
        ) : (
          <TestDashboard session={session} />
        )
      )}
    </div>
  );
}