'use client';
import { usePathname } from "next/navigation";
import sections from "./items/menu_items.json";
import SidebarItem from "./items/sidebar_item";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/hasPermissions";
import { ROLES, sectionPermissions, sectionItemPermissions } from "@/lib/constants";
import OrgSwitcher from "@/components/main/organizationSwitcher";
import { useEffect, useState } from "react";
import { LayoutGrid, ChevronLeft, Building2 } from "lucide-react";

export default function Sidebar({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
    const { data: session } = useSession();
    const [organizations, setOrganizations] = useState<any[]>([]);
    const pathname = usePathname();

    const isValidSection = (section: string) => {
        if (section === "general") return true;
        return hasPermission(session, sectionPermissions[section]);
    };

    useEffect(() => {
        const userOrgs = session?.user?.organizations?.map((org: any) => ({
            ...org,
            clientId: org.clientId,
            clientName: org.clientName || "Unnamed Org",
            role: org.role
        })) || [];
        setOrganizations(userOrgs);
    }, [session?.user?.organizations]);

    return (
        <>
            {/* MOBILE OVERLAY */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-brand/20 z-40 md:hidden backdrop-blur-sm transition-opacity"
                    onClick={onToggle}
                />
            )}

            <aside className={`
                fixed inset-y-0 left-0 z-50 transition-all duration-500 ease-in-out
                bg-brand text-white shadow-2xl flex flex-col
                ${isOpen ? "w-72 translate-x-0" : "w-0 -translate-x-full md:w-20 md:translate-x-0 overflow-hidden md:overflow-visible"}
            `}>
                
                {/* LOGO AREA */}
                <div className="h-20 flex items-center px-6 mb-4 relative">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-accent rounded-xl flex items-center justify-center shadow-lg shadow-brand-accent/20">
                            <LayoutGrid className="text-brand" size={20} />
                        </div>
                        <span className={`text-xl font-black tracking-tighter transition-opacity duration-300 ${!isOpen && 'opacity-0'}`}>
                            TEMPI
                        </span>
                    </div>
                    
                    {/* Toggle Button for Desktop */}
                    <button 
                        onClick={onToggle}
                        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-brand-accent rounded-full flex items-center justify-center text-brand border-2 border-brand shadow-md hover:scale-110 transition-transform"
                    >
                        <ChevronLeft size={14} className={`transition-transform duration-500 ${!isOpen && 'rotate-180'}`} />
                    </button>
                </div>

                {/* ORGANIZATION SWITCHER AREA */}
                <div className={`px-4 mb-6 transition-all duration-300 ${!isOpen ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
                    {session?.user?.role !== ROLES.SUPERADMIN && (
                        <div className="bg-white/5 p-4 rounded-4xl border border-white/10 shadow-inner">
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <Building2 size={12} className="text-brand-accent" />
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Espacio de Trabajo</p>
                            </div>
                            <OrgSwitcher userOrgs={organizations} /> 
                        </div>
                    )}
                </div>

                {/* NAVIGATION MENU */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden px-4 custom-scrollbar">
                    {Object.entries(sections).map(([section, items]) => (
                        <div key={section} className="mb-8">
                            {isValidSection(section) && (
                                <>
                                    <div className={`flex items-center gap-3 px-4 mb-3 transition-opacity duration-300 ${!isOpen && 'opacity-0'}`}>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/30 whitespace-nowrap">
                                            {section}
                                        </h3>
                                        <div className="h-px w-full bg-white/5"></div>
                                    </div>

                                    <div className="space-y-1.5">
                                        {items.map((item: any) => (
                                            <SidebarItem
                                                key={item.href}
                                                href={item.href}
                                                label={item.label}
                                                iconName={item.icon} // Ensure SidebarItem handles icons
                                                isActive={pathname === item.href}
                                                isCollapsed={!isOpen}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </nav>

                {/* USER PROFILE MINIFIED FOOTER */}
                <div className="p-4 border-t border-white/5 bg-black/10">
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-10 h-10 rounded-xl bg-surface/10 border border-white/10 flex items-center justify-center font-bold text-brand-accent">
                            {session?.user?.name?.charAt(0) || 'U'}
                        </div>
                        <div className={`transition-opacity duration-300 ${!isOpen ? 'opacity-0' : 'opacity-100'}`}>
                            <p className="text-xs font-bold truncate w-32">{session?.user?.name}</p>
                            <p className="text-[10px] text-white/40 uppercase font-bold tracking-tighter">{session?.user?.role}</p>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}