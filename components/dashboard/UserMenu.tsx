'use client';
import { signOut, useSession } from "next-auth/react";
import { clearOfflineCache } from "@/lib/offline-queue";
import { ChevronDown, LogOut, User, UserCog } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { roleLabel } from "@/i18n/labels";
import { activeMembership } from "@/lib/permissions";
import { localeNames, locales } from "@/i18n/config";
import { useLocaleSwitcher } from "@/i18n/useLocaleSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import { useDismiss } from "@/components/dashboard/useDismiss";

/** The profile button in the navbar, and the menu it opens: theme, language, account and sign out. */
export default function UserMenu() {
    const t = useTranslations("nav");
    const tCommon = useTranslations("common");
    const tRoles = useTranslations("roles");
    const tTheme = useTranslations("theme");
    const { data: session } = useSession();
    const pathname = usePathname();
    const { locale, switchLocale } = useLocaleSwitcher();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const close = useCallback(() => setIsOpen(false), []);
    useDismiss(menuRef, isOpen, close);

    const name = session?.user?.name || tCommon("user");
    const role = session?.user?.role ? roleLabel(tRoles, session.user.role, activeMembership(session)?.roleName) : t("defaultRole");

    return (
        <div className="relative pl-4 border-l border-line" ref={menuRef}>
            <button
                onClick={() => setIsOpen(open => !open)}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-label={t("userMenu")}
                className="flex items-center gap-3 rounded-2xl group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-ink leading-tight">{name}</p>
                    <p className="text-[11px] font-semibold text-accent uppercase tracking-wider mt-0.5">{role}</p>
                </div>

                {/* Avatar with Status Ring */}
                <div className="relative">
                    <div className={`w-11 h-11 bg-subtle border rounded-2xl flex items-center justify-center text-ink-muted transition-all group-hover:border-line-strong ${isOpen ? "border-accent" : "border-line"}`}>
                        {session?.user?.image ? (
                            <img src={session.user.image} alt={t("avatar")} className="w-full h-full rounded-2xl object-cover" />
                        ) : (
                            <User size={22} strokeWidth={2.5} />
                        )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success border-2 border-canvas rounded-full"></div>
                </div>

                <ChevronDown size={16} className={`hidden sm:block text-ink-subtle transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            <div
                role="menu"
                className={`absolute right-0 top-full mt-3 w-72 origin-top-right transition-all duration-200 ${isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"}`}
            >
                <div className="bg-card border border-line rounded-2xl p-2 shadow-2xl">
                    {/* Who is signed in */}
                    <div className="px-3 py-2.5">
                        <p className="text-sm font-semibold text-ink truncate">{name}</p>
                        {session?.user?.email && <p className="text-xs text-ink-subtle truncate">{session.user.email}</p>}
                    </div>

                    <div className="my-1 border-t border-line" />

                    <div className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="text-xs font-semibold text-ink-muted">{tTheme("label")}</span>
                        <ThemeToggle />
                    </div>

                    <div className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="text-xs font-semibold text-ink-muted">{t("language")}</span>
                        <div role="radiogroup" aria-label={t("language")} className="inline-flex items-center gap-0.5 rounded-full border border-line bg-card p-1">
                            {locales.map(code => {
                                const selected = locale === code;
                                return (
                                    <button
                                        key={code}
                                        role="radio"
                                        aria-checked={selected}
                                        title={localeNames[code]}
                                        onClick={() => switchLocale(code)}
                                        className={`h-7 px-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${selected ? "bg-subtle text-ink" : "text-ink-subtle hover:text-ink"}`}
                                    >
                                        {code}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="my-1 border-t border-line" />

                    <Link
                        href="/account"
                        role="menuitem"
                        aria-current={pathname === "/account" ? "page" : undefined}
                        onClick={close}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-ink hover:bg-subtle transition-colors"
                    >
                        <UserCog size={18} className="text-ink-subtle" />
                        {t("account")}
                    </Link>
                    <button
                        role="menuitem"
                        onClick={async () => { await clearOfflineCache(); signOut({ redirect: true, callbackUrl: "/" }); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-danger hover:bg-danger/10 transition-colors"
                    >
                        <LogOut size={18} />
                        {tCommon("logout")}
                    </button>
                </div>
            </div>
        </div>
    );
}
