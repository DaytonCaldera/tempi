'use client';
import { signOut, useSession } from "next-auth/react";
import { Menu, LogOut, User, Bell } from "lucide-react";

interface NavbarProps {
    isSidebarOpen: boolean;
    onToggle: () => void;
}

export default function Navbar({ isSidebarOpen, onToggle }: NavbarProps) {
    const { data: session } = useSession();

    return (
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-brand/5 flex items-center justify-between px-6 md:px-10 sticky top-0 z-40 transition-all">
            
            {/* 1. LEFT SIDE: MOBILE-ONLY TRIGGER */}
            <div className="flex items-center gap-4">
                <button 
                    onClick={onToggle} 
                    className="md:hidden p-3 bg-surface text-brand border border-brand/10 rounded-2xl hover:bg-brand/5 transition-all active:scale-95 group"
                    aria-label="Toggle Sidebar"
                >
                    <Menu size={22} className="group-hover:rotate-12 transition-transform" />
                </button>
                
                {/* Dynamic Title based on Sidebar State */}
                <div className={`hidden md:block transition-all duration-500 ${isSidebarOpen ? 'ml-0' : 'ml-4'}`}>
                     <p className="text-[10px] font-black text-brand/30 uppercase tracking-[0.3em]">Gestión de Operaciones</p>
                </div>
            </div>

            {/* 2. RIGHT SIDE: NOTIFICATIONS & PROFILE */}
            <div className="flex items-center gap-3 ml-auto">
                
                {/* Sublte Notification Bell */}
                <button className="p-3 text-brand/40 hover:text-brand hover:bg-surface rounded-xl transition-all relative mr-2">
                    <Bell size={20} />
                    <span className="absolute top-3 right-3 w-2 h-2 bg-brand-accent rounded-full border-2 border-white"></span>
                </button>

                {/* Profile Section */}
                <div className="flex items-center gap-4 pl-4 border-l border-brand/5">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-black text-brand leading-tight">
                            {session?.user?.name || "Usuario"}
                        </p>
                        <p className="text-[11px] font-black text-brand-accent uppercase tracking-wider mt-0.5">
                            {session?.user?.role || "Personal"}
                        </p>
                    </div>

                    {/* Avatar with Status Ring */}
                    <div className="relative group cursor-pointer">
                        <div className="w-11 h-11 bg-surface border border-brand/10 rounded-2xl flex items-center justify-center text-brand shadow-sm group-hover:shadow-md transition-all">
                            {session?.user?.image ? (
                                <img src={session.user.image} alt="Avatar" className="w-full h-full rounded-2xl object-cover" />
                            ) : (
                                <User size={22} strokeWidth={2.5} />
                            )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success border-2 border-white rounded-full"></div>
                    </div>
                </div>

                {/* Sign Out - Refined Danger Style */}
                <button 
                    onClick={() => signOut({ redirect: true, callbackUrl: "/" })}
                    className="ml-4 p-3 text-brand/40 hover:text-danger hover:bg-danger/5 rounded-2xl transition-all group"
                    title="Cerrar Sesión"
                >
                    <LogOut size={20} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
            </div>
        </header>
    );
}