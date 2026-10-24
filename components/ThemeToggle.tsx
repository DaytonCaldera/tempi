'use client';
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { THEMES, useTheme } from "@/lib/theme";

const ICONS = { light: Sun, dark: Moon, system: Monitor };

/** Light / dark / system switch, as a small segmented pill. */
export default function ThemeToggle({ className = "" }: { className?: string }) {
    const t = useTranslations("theme");
    const { theme, setTheme } = useTheme();

    return (
        <div role="radiogroup" aria-label={t("label")} className={`inline-flex items-center gap-0.5 rounded-full border border-line bg-card p-1 ${className}`}>
            {THEMES.map(option => {
                const Icon = ICONS[option];
                const selected = theme === option;
                return (
                    <button
                        key={option}
                        role="radio"
                        aria-checked={selected}
                        aria-label={t(option)}
                        title={t(option)}
                        onClick={() => setTheme(option)}
                        className={`flex h-7 w-7 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${selected ? "bg-subtle text-ink" : "text-ink-subtle hover:text-ink"}`}
                    >
                        <Icon className="h-3.5 w-3.5" />
                    </button>
                );
            })}
        </div>
    );
}
