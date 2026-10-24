"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { Check, Globe, LayoutDashboard, LogOut, MoreHorizontal, SunMoon } from "lucide-react";
import { localeNames, locales } from "@/i18n/config";
import { useLocaleSwitcher } from "@/i18n/useLocaleSwitcher";
import { THEMES, useTheme } from "@/lib/theme";

/** State of the stock polling, for the status next to the title. */
export interface SyncState {
    isValidating: boolean;
    hasError: boolean;
    /** When the stock was last loaded successfully (ms). */
    lastUpdated: number;
}

interface RunnerHeaderProps {
    assignedAreaCount: number;
    sync: SyncState;
}

const subscribeToOnline = (onChange: () => void) => {
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
    };
};

/** Whether the browser has a connection (always true while rendering on the server). */
const useIsOnline = () => useSyncExternalStore(subscribeToOnline, () => navigator.onLine, () => true);

/** Green while stock is up to date; says so (and how old it is) when it can't be refreshed. */
function SyncStatus({ isValidating, hasError, lastUpdated }: SyncState) {
    const t = useTranslations('runner.sync');
    const format = useFormatter();
    const isOnline = useIsOnline();
    const now = useNow({ updateInterval: 10_000 });

    const status = !isOnline ? 'offline' : hasError ? 'error' : isValidating ? 'syncing' : 'live';
    const dotColor = { live: 'bg-success', syncing: 'bg-accent animate-pulse', error: 'bg-warning', offline: 'bg-ink-subtle' }[status];
    const isStale = status === 'offline' || status === 'error';

    return (
        <p className="flex flex-wrap items-center gap-x-1.5 mt-1 text-[11px] font-black text-ink-subtle uppercase tracking-widest">
            <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
            {t(status)}
            {isStale && <span className="normal-case tracking-normal font-bold">· {t('updated', { time: format.relativeTime(lastUpdated, now) })}</span>}
        </p>
    );
}

/** Dashboard, language, theme and sign out, behind a ⋯ button so they don't compete with the stock list. */
function HeaderMenu() {
    const t = useTranslations('runner');
    const tCommon = useTranslations('common');
    const tTheme = useTranslations('theme');
    const { locale, switchLocale } = useLocaleSwitcher();
    const { theme, setTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on a click outside the menu or on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [isOpen]);

    const itemClass = "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold hover:bg-subtle active:bg-subtle";
    const sectionClass = "flex items-center gap-3 px-4 pt-3 pb-1 text-[11px] font-black text-ink-subtle uppercase tracking-widest";

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-label={t('menu')}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                className="w-11 h-11 flex items-center justify-center rounded-2xl bg-subtle text-ink-muted active:scale-95 transition-all"
            >
                <MoreHorizontal size={20} />
            </button>

            {isOpen && (
                <div role="menu" className="absolute right-0 top-full mt-2 z-50 w-56 bg-card rounded-2xl border border-line shadow-2xl p-1.5">
                    <Link href="/dashboard" role="menuitem" className={`${itemClass} text-ink-muted`}>
                        <LayoutDashboard size={18} className="text-ink-subtle" /> {tCommon('dashboard')}
                    </Link>

                    <p className={sectionClass}>
                        <Globe size={14} /> {t('language')}
                    </p>
                    {locales.map(code => (
                        <button
                            key={code}
                            role="menuitemradio"
                            aria-checked={locale === code}
                            onClick={() => { switchLocale(code); setIsOpen(false); }}
                            className={`${itemClass} text-ink-muted pl-11 justify-between`}
                        >
                            {localeNames[code]}
                            {locale === code && <Check size={16} className="text-accent" />}
                        </button>
                    ))}

                    <p className={sectionClass}>
                        <SunMoon size={14} /> {tTheme('label')}
                    </p>
                    {THEMES.map(option => (
                        <button
                            key={option}
                            role="menuitemradio"
                            aria-checked={theme === option}
                            onClick={() => setTheme(option)}
                            className={`${itemClass} text-ink-muted pl-11 justify-between`}
                        >
                            {tTheme(option)}
                            {theme === option && <Check size={16} className="text-accent" />}
                        </button>
                    ))}

                    <div className="h-px bg-line my-1.5" />
                    <button role="menuitem" onClick={() => signOut({ callbackUrl: "/" })} className={`${itemClass} text-danger hover:bg-danger/10`}>
                        <LogOut size={18} /> {tCommon('logout')}
                    </button>
                </div>
            )}
        </div>
    );
}

export default function RunnerHeader({ assignedAreaCount, sync }: RunnerHeaderProps) {
    const t = useTranslations('runner');

    return (
        <header className="bg-card px-4 pt-6 pb-4 border-b border-line">
            <div className="max-w-md mx-auto flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-2xl font-black text-ink leading-tight">{t('title')}</h1>
                    <p className="mt-1 text-[11px] font-black text-ink-subtle uppercase tracking-widest">
                        {t('assignedAreas', { count: assignedAreaCount })}
                    </p>
                    <SyncStatus {...sync} />
                </div>
                <HeaderMenu />
            </div>
        </header>
    );
}
