'use client';
import { useSession } from "next-auth/react";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import NotificationsMenu from "@/components/dashboard/NotificationsMenu";
import UserMenu from "@/components/dashboard/UserMenu";

interface NavbarProps {
    isSidebarOpen: boolean;
    onToggle: () => void;
}

export default function Navbar({ isSidebarOpen, onToggle }: NavbarProps) {
    const t = useTranslations("nav");
    const { data: session } = useSession();
    const [clientName, setClientName] = useState("");

    useEffect(() => {
        async function fetchClientName() {
            if (!session?.user?.clientId) return;
            try {
                const res = await fetch("/api/admin/clients/name");
                if (res.ok) {
                    const data = await res.json();
                    setClientName(data.name || "");
                }
            } catch (error) {
                console.error("Error fetching client name:", error);
            }
        }
        fetchClientName();
    }, [session?.user?.clientId]);

    return (
        <header className="h-20 bg-canvas/80 backdrop-blur-md border-b border-line flex items-center justify-between px-6 md:px-10 sticky top-0 z-40 transition-all print:hidden">

            {/* 1. LEFT SIDE: MOBILE-ONLY TRIGGER */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onToggle}
                    className="md:hidden p-3 bg-card text-ink border border-line rounded-2xl hover:bg-subtle transition-all active:scale-95 group"
                    aria-label={t("toggleSidebar")}
                >
                    <Menu size={22} className="group-hover:rotate-12 transition-transform" />
                </button>

                {/* Dynamic Title based on Sidebar State */}
                <div className={`hidden md:block transition-all duration-500 ${isSidebarOpen ? 'ml-0' : 'ml-4'}`}>
                     <p className="text-xs font-semibold text-ink-subtle uppercase tracking-[0.2em]">{clientName}</p>
                </div>
            </div>

            {/* 2. RIGHT SIDE: NOTIFICATIONS & USER MENU */}
            <div className="flex items-center gap-3 ml-auto">
                <NotificationsMenu />
                <UserMenu />
            </div>
        </header>
    );
}
