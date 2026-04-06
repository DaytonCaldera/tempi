'use client';
import { signOut, useSession } from "next-auth/react";
import { Menu, X, LogOut, User } from "lucide-react";

interface NavbarProps {
    isSidebarOpen: boolean;
    onToggle: () => void;
}

export default function Navbar({ isSidebarOpen, onToggle }: NavbarProps) {
    const { data: session } = useSession();

    return (
        <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-6 md:px-10 z-30 shadow-sm">
            {/* 1. LEFT SIDE: MOBILE TRIGGER */}
            <div className="flex items-center gap-4">
                <button 
                    onClick={onToggle} 
                    className="p-3 bg-gray-50 text-gray-600 border border-gray-200 rounded-2xl hover:bg-gray-100 transition-all active:scale-95 group"
                    aria-label="Toggle Sidebar"
                >
                    {isSidebarOpen ? (
                        <X size={22} className="group-hover:rotate-90 transition-transform duration-300" />
                    ) : (
                        <Menu size={22} />
                    )}
                </button>
              
            </div>

            {/* 2. RIGHT SIDE: USER PROFILE & ACTIONS */}
            <div className="flex items-center gap-6 ml-auto">
                
                {/* User Info - Now 14px (text-sm) with Subtle Blue */}
                <div className="flex items-center gap-4 border-r border-gray-100 pr-6 hidden sm:flex">
                    <div className="text-right">
                        <p className="text-sm font-bold text-gray-900 leading-tight">
                            {session?.user?.name || "Usuario"}
                        </p>
                        {/* Subtle Blue Text */}
                        <p className="text-[13px] font-bold text-blue-500/80 uppercase tracking-tight mt-0.5">
                            {session?.user?.role || "Personal"}
                        </p>
                    </div>
                    {/* Subtle Blue Avatar */}
                    <div className="w-11 h-11 bg-blue-50/50 border border-blue-100/50 rounded-2xl flex items-center justify-center text-blue-400">
                        <User size={22} strokeWidth={2} />
                    </div>
                </div>

                {/* Sign Out - Subtle Red Style */}
                <button 
                    onClick={() => signOut({ redirect: true, callbackUrl: "/" })}
                    className="flex items-center gap-2 text-sm font-bold bg-red-50/40 text-red-500/80 px-5 py-2.5 rounded-2xl hover:bg-red-50 hover:text-red-600 transition-all active:scale-95 border border-red-100/30"
                >
                    <span className="hidden lg:inline">Cerrar Sesión</span>
                    <LogOut size={18} strokeWidth={2} />
                </button>
            </div>
        </header>
    );
}