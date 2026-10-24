'use client';
import Link from "next/link";
import { usePathname } from "next/navigation";
import sections from "./menuItems.json";
import SidebarItem from "./SidebarItem";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { hasPermission } from "@/lib/permissions";
import { sectionPermissions } from "@/lib/constants";
import { labelOf } from "@/i18n/labels";
import OrganizationSwitcher from "@/components/dashboard/OrganizationSwitcher";
import { LayoutGrid, ChevronLeft, Building2 } from "lucide-react";

/**
 * `labelKey` is a key of the "nav" messages. `requiresOrganization` hides the item while the user has no
 * active organization (e.g. right after closing their last one, on the account page). `requiresAssignedAreas`
 * shows it only to users assigned to departments in the active organization (runners).
 */
type MenuItem = {
    href: string; labelKey: string; icon: string; permission?: string;
    requiresOrganization?: boolean; requiresAssignedAreas?: boolean;
};

export default function Sidebar({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
    const t = useTranslations("nav");
    const tRoles = useTranslations("roles");
    const { data: session } = useSession();
    const pathname = usePathname();

    const organizations = (session?.user?.organizations || []).map(org => ({
        ...org,
        clientName: org.clientName || t("unnamedOrganization"),
    }));

    const isValidSection = (section: string) => {
        if (section === "general") return true;
        return hasPermission(session, sectionPermissions[section]);
    };

    const hasOrganization = !!session?.user?.clientId;
    const hasAssignedAreas = !!session?.user?.organizations
        ?.find(m => m.clientId === session.user.clientId)?.departments?.length;
    const isVisible = (item: MenuItem) =>
        (hasOrganization || !item.requiresOrganization) && (hasAssignedAreas || !item.requiresAssignedAreas);

    return (
        <>
            {/* MOBILE OVERLAY */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm transition-opacity print:hidden"
                    onClick={onToggle}
                />
            )}

            <aside className={`
                fixed inset-y-0 left-0 z-50 transition-all duration-500 ease-in-out
                bg-card text-ink border-r border-line flex flex-col print:hidden
                ${isOpen ? "w-72 translate-x-0" : "w-0 -translate-x-full md:w-20 md:translate-x-0 overflow-hidden md:overflow-visible"}
            `}>
                
                {/* LOGO AREA */}
                <div className="h-20 flex items-center px-6 mb-4 relative">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shrink-0">
                            <LayoutGrid className="text-on-accent" size={20} />
                        </div>
                        <span className={`text-xl font-semibold tracking-tight transition-opacity duration-300 ${!isOpen && 'opacity-0'}`}>
                            VITALLIZ
                        </span>
                    </div>
                    
                    {/* Toggle Button for Desktop */}
                    <button 
                        onClick={onToggle}
                        aria-label={t("toggleSidebar")}
                        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-card rounded-full hidden md:flex items-center justify-center text-ink-muted border border-line shadow-sm hover:text-ink hover:scale-110 transition"
                    >
                        <ChevronLeft size={14} className={`transition-transform duration-500 ${!isOpen && 'rotate-180'}`} />
                    </button>
                </div>

                {/* ORGANIZATION SWITCHER AREA */}
                <div className={`px-4 mb-6 transition-all duration-300 ${!isOpen ? 'opacity-0 scale-95 pointer-events-none w-0 h-0 p-0 m-0' : 'opacity-100 scale-100'}`}>
                    <div className="bg-subtle p-4 rounded-3xl border border-line">
                        <div className="flex items-center gap-2 mb-3 px-1">
                            <Building2 size={12} className="text-accent" />
                            <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-[0.2em]">{t("workspace")}</p>
                        </div>
                        <OrganizationSwitcher userOrgs={organizations} />
                    </div>
                </div>

                {/* NAVIGATION MENU */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden px-4 custom-scrollbar">
                    {Object.entries(sections as Record<string, MenuItem[]>).map(([section, items]) => (
                        <div key={section} className="mb-8">
                            {isValidSection(section) && (
                                <>
                                    <div className={`flex items-center gap-3 px-4 mb-3 transition-opacity duration-300 ${!isOpen && 'opacity-0'}`}>
                                        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-subtle whitespace-nowrap">
                                            {t(`sections.${section}`)}
                                        </h3>
                                        <div className="h-px w-full bg-line"></div>
                                    </div>

                                    <div className="space-y-1.5">
                                        {items.filter(isVisible).map(item => (
                                            <SidebarItem
                                                key={item.href}
                                                href={item.href}
                                                label={t(item.labelKey)}
                                                iconName={item.icon}
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
                <div className="p-4 border-t border-line">
                    <Link href="/account" title={t("account")} className="flex items-center gap-3 px-2 py-1 rounded-2xl hover:bg-subtle transition-all">
                        <div className="w-10 h-10 shrink-0 rounded-xl bg-subtle border border-line flex items-center justify-center font-semibold text-accent">
                            {session?.user?.name?.charAt(0) || 'U'}
                        </div>
                        <div className={`transition-opacity duration-300 ${!isOpen ? 'opacity-0' : 'opacity-100'}`}>
                            <p className="text-xs font-semibold truncate w-32">{session?.user?.name}</p>
                            <p className="text-[10px] text-ink-subtle uppercase font-semibold tracking-wider">{session?.user?.role && labelOf(tRoles, session.user.role)}</p>
                        </div>
                    </Link>
                </div>
            </aside>
        </>
    );
}