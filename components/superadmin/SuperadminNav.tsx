'use client';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Building2, CreditCard, HeartPulse, LayoutDashboard, LifeBuoy, LogOut, ScrollText, ShieldCheck, UserRound, Users } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const ITEMS = [
    { href: "/superadmin", labelKey: "overview", icon: LayoutDashboard },
    { href: "/superadmin/health", labelKey: "health", icon: HeartPulse },
    { href: "/superadmin/organizations", labelKey: "organizations", icon: Building2 },
    { href: "/superadmin/users", labelKey: "users", icon: Users },
    { href: "/superadmin/plans", labelKey: "plans", icon: CreditCard },
    { href: "/superadmin/support", labelKey: "support", icon: LifeBuoy },
    { href: "/superadmin/audit", labelKey: "audit", icon: ScrollText },
] as const;

/** Navigation of the /superadmin panel. Only rendered by its layout, after the server checked the role. */
export default function SuperadminNav() {
    const t = useTranslations("superadmin");
    const pathname = usePathname();
    const isActive = (href: string) => href === "/superadmin" ? pathname === href : pathname.startsWith(href);

    return (
        <aside className="flex flex-col gap-6 border-b border-line bg-card p-4 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r md:p-6 print:hidden">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-inverse">
                    <ShieldCheck className="text-on-inverse" size={20} aria-hidden />
                </div>
                <div>
                    <p className="text-lg font-semibold leading-tight tracking-tight">VITALLIZ</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">{t("panel")}</p>
                </div>
            </div>

            <nav aria-label={t("nav.menu")} className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
                {ITEMS.map(({ href, labelKey, icon: Icon }) => (
                    <Link
                        key={href}
                        href={href}
                        aria-current={isActive(href) ? "page" : undefined}
                        className={`flex shrink-0 items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors ${isActive(href) ? "bg-inverse text-on-inverse" : "text-ink-muted hover:bg-subtle hover:text-ink"}`}
                    >
                        <Icon size={18} aria-hidden />
                        {t(`nav.${labelKey}`)}
                    </Link>
                ))}
            </nav>

            <div className="mt-auto hidden flex-col gap-3 md:flex">
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <LanguageSwitcher />
                </div>
                <a href="/account" className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-semibold text-ink-muted hover:bg-subtle hover:text-ink">
                    <UserRound size={18} aria-hidden /> {t("nav.account")}
                </a>
                <button
                    onClick={() => signOut({ redirect: true, callbackUrl: "/" })}
                    className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm font-semibold text-ink-muted hover:bg-danger/10 hover:text-danger"
                >
                    <LogOut size={18} aria-hidden /> {t("nav.signOut")}
                </button>
            </div>
        </aside>
    );
}
