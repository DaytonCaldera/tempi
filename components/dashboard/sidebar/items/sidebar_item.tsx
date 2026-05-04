'use client';
import Link from "next/link";
import * as LucideIcons from "lucide-react";

type SidebarItemProps = {
    href: string;
    label: string;
    iconName?: string; // Passed from menu_items.json
    isActive?: boolean;
    isCollapsed?: boolean;
};

export default function SidebarItem({ 
    href, 
    label, 
    iconName, 
    isActive = false, 
    isCollapsed = false 
}: SidebarItemProps) {
    
    // Dynamically resolve the icon component
    const Icon = iconName ? (LucideIcons as any)[iconName] : LucideIcons.Package;

    return (
        <Link 
            href={href} 
            className={`
                group relative flex items-center gap-3 py-3 px-4 rounded-2xl 
                transition-all duration-300 ease-out
                ${isActive 
                    ? 'bg-surface text-brand shadow-sm shadow-black/5' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }
                ${isCollapsed ? 'justify-center px-0' : 'mx-2'}
            `}
        >
            {/* ACTIVE INDICATOR (Vertical pill) */}
            {isActive && !isCollapsed && (
                <div className="absolute left-0 w-1 h-6 bg-brand-accent rounded-full -translate-x-1" />
            )}

            {/* ICON */}
            <div className={`
                flex-shrink-0 transition-transform duration-300
                ${isActive ? 'text-brand' : 'text-white/40 group-hover:text-white'}
                ${isCollapsed ? 'scale-110' : 'scale-100'}
            `}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            </div>

            {/* LABEL */}
            <span className={`
                font-bold text-sm whitespace-nowrap transition-all duration-300
                ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}
            `}>
                {label}
            </span>

            {/* COLLAPSED TOOLTIP (Optional but great for accessibility) */}
            {isCollapsed && (
                <div className="absolute left-full ml-4 px-3 py-1 bg-brand border border-white/10 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                    {label}
                </div>
            )}
        </Link>
    );
}