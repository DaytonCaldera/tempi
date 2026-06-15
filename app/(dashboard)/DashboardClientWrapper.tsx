'use client';
import { useState, useEffect } from "react";
import Navbar from "@/components/dashboard/navbar/navbar";
import Sidebar from "@/components/dashboard/sidebar/sidebar";

export default function DashboardClientWrapper({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setSidebarOpen] = useState(true);

    useEffect(() => {
        if (window.innerWidth < 1024) setSidebarOpen(false);
    }, []);

    const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

    return (
        <div className="flex h-screen bg-surface overflow-hidden">
            {/* SIDEBAR */}
            <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />

            {/* MAIN VIEWPORT */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className={`flex flex-col h-full transition-all duration-500 ease-in-out ${isSidebarOpen ? 'md:pl-72' : 'md:pl-20'}`}>
                    {/* NAVBAR */}
                    <Navbar
                        onToggle={toggleSidebar}
                        isSidebarOpen={isSidebarOpen}
                    />

                    {/* CONTENT AREA */}
                    <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8">
                        <div className="mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}