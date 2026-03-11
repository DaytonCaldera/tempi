import { usePathname } from "next/navigation";
import sections from "./items/menu_items.json";
import SidebarItem from "./items/sidebar_item";
import styles from "./sidebar.module.css";


export default function Sidebar({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
    return (
        <>
            {/* MOBILE OVERLAY: Dims the background when sidebar is open on mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-40 md:hidden backdrop-blur-sm"
                    onClick={onToggle}
                />
            )}

            <aside className={`${styles.sidebar} text-white py-7 shadow-lg z-50 fixed inset-y-0 left-0 md:relative transition-all duration-300 ease-in-out 
                    ${isOpen
                    ? "translate-x-0 w-64"
                    : "-translate-x-full w-0 md:w-0 md:-translate-x-full"
                } `}
            >
                <div className={`px-4 mb-10 transition-opacity duration-200 ${!isOpen ? 'opacity-0' : 'opacity-100'}`}>
                    <span className="text-2xl font-bold tracking-tight">TEMPI</span>
                </div>

                <nav className={`space-y-1 transition-opacity duration-200 ${!isOpen ? 'opacity-0' : 'opacity-100'}`}>
                    {Object.entries(sections).map(([section, items]) => (
                        <div key={section}>
                            <h3 className="px-4 mt-8 mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 select-none">
                                {section}
                            </h3>
                            <div className="space-y-1">
                                {items.map((item: any) => (
                                    <SidebarItem
                                        key={item.href}
                                        href={item.href}
                                        label={item.label}
                                        isActive={usePathname() === item.href}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>
            </aside>
        </>
    );
}