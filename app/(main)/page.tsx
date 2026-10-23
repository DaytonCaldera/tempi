'use client'
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react"
import { ROLES } from "@/lib/constants";
import Landing from "@/components/main/Landing";
import PendingApproval from "@/components/main/PendingApproval";

const Loading = () => (
  <div className="flex items-center justify-center min-h-screen p-6">
    <p className="text-gray-500">Cargando...</p>
  </div>
);

/**
 * Entry point. Logged-out visitors see the landing page, pending users wait for approval here,
 * and everyone else is sent to the page for their role.
 */
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

  if (status === "loading") return <Loading />;

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
      {!session ? <Landing />
        : session.user?.role === ROLES.PENDING_USER ? <PendingApproval />
        : <Loading />}
    </div>
  );
}
