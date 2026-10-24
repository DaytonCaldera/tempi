'use client';
import { signOut, useSession } from "next-auth/react";
import { clearOfflineCache } from "@/lib/offline-queue";
import { Menu, LogOut, User, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { labelOf } from "@/i18n/labels";
import ThemeToggle from "@/components/ThemeToggle";

interface NavbarProps {
    isSidebarOpen: boolean;
    onToggle: () => void;
}

export default function Navbar({ isSidebarOpen, onToggle }: NavbarProps) {
    const t = useTranslations("nav");
    const tCommon = useTranslations("common");
    const tRoles = useTranslations("roles");
    const { data: session } = useSession();
    const pathname = usePathname();
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

            {/* 2. RIGHT SIDE: NOTIFICATIONS & PROFILE */}
            <div className="flex items-center gap-3 ml-auto">
                <ThemeToggle className="hidden sm:inline-flex" />

                
                {/* Subtle Notification Bell */}
                <button className="p-3 text-ink-subtle hover:text-ink hover:bg-subtle rounded-xl transition-all relative">
                    <Bell size={20} />
                    <span className="absolute top-3 right-3 w-2 h-2 bg-accent rounded-full border-2 border-canvas"></span>
                </button>

                {/* Profile Section: opens the account page */}
                <Link
                    href="/account"
                    aria-label={t("account")}
                    title={t("account")}
                    aria-current={pathname === "/account" ? "page" : undefined}
                    className="flex items-center gap-4 pl-4 border-l border-line rounded-r-2xl group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold text-ink leading-tight">
                            {session?.user?.name || tCommon("user")}
                        </p>
                        <p className="text-[11px] font-semibold text-accent uppercase tracking-wider mt-0.5">
                            {session?.user?.role ? labelOf(tRoles, session.user.role) : t("defaultRole")}
                        </p>
                    </div>

                    {/* Avatar with Status Ring */}
                    <div className="relative">
                        <div className={`w-11 h-11 bg-subtle border rounded-2xl flex items-center justify-center text-ink-muted transition-all group-hover:border-line-strong ${pathname === "/account" ? "border-accent" : "border-line"}`}>
                            {session?.user?.image ? (
                                <img src={session.user.image} alt={t("avatar")} className="w-full h-full rounded-2xl object-cover" />
                            ) : (
                                <User size={22} strokeWidth={2.5} />
                            )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success border-2 border-canvas rounded-full"></div>
                    </div>
                </Link>

                {/* Sign Out - Refined Danger Style */}
                <button 
                    onClick={async () => { await clearOfflineCache(); signOut({ redirect: true, callbackUrl: "/" }); }}
                    className="ml-1 p-3 text-ink-subtle hover:text-danger hover:bg-danger/10 rounded-2xl transition-all group"
                    title={tCommon("logout")}
                >
                    <LogOut size={20} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
            </div>
        </header>
    );
}