"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StatusToggle({ userId, isActive }: { userId: string, isActive: boolean }) {
    const [isPending, setIsPending] = useState(false);
    const router = useRouter();

    const handleToggle = async () => {
        setIsPending(true);
        try {
            const res = await fetch("/api/admin/users/toggle-status", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, isActive }),
            });

            if (res.ok) {
                // This triggers the Server Component to re-fetch MongoDB data
                router.refresh(); 
            }
        } catch (error) {
            console.error("Toggle failed", error);
        } finally {
            setIsPending(false);
        }
    };

    return (
        <button
            onClick={handleToggle}
            disabled={isPending}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${
                isActive 
                    ? "text-red-500 hover:bg-red-50" 
                    : "text-green-600 hover:bg-green-50"
            } disabled:opacity-50`}
        >
            {isPending ? "..." : isActive ? "Desactivar" : "Activar"}
        </button>
    );
}