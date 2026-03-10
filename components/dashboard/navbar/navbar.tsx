'use client';
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";

export default function Navbar({isSidebarOpen, onToggle}: any) {
    const { data: session } = useSession();
    return (
        <header className="bg-[#F7EFDE] border-b border-[#DEE7F7] h-16 flex items-center justify-between px-8 shadow-sm">
          <button onClick={onToggle} className="text-[#000000] border border-[#7789AA] px-3 py-1 rounded-md cursor-pointer">
            ☰
          </button>
          <div className="flex items-center gap-4 ml-auto">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{session?.user?.name}</p>
              <p className="text-xs text-[#AA9F88] capitalize">{session?.user?.role}</p>
            </div>
            <button 
              onClick={() => signOut({redirect: true, callbackUrl: "/"})}
              className="text-sm border border-[#7789AA] text-[#000] px-4 py-1.5 rounded hover:bg-[#DEE7F7] transition"
            >
              Sign Out
            </button>
          </div>
        </header>
    );
}