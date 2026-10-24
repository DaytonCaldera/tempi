import { useSyncExternalStore } from "react";
import { CHANGE_EVENT, STORAGE_KEY } from "@/lib/theme-script";

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

function readTheme(): Theme {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === "light" || stored === "dark" ? stored : "system";
    } catch {
        return "system";
    }
}

function subscribe(onChange: () => void) {
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
        window.removeEventListener(CHANGE_EVENT, onChange);
        window.removeEventListener("storage", onChange);
    };
}

/** The saved theme preference ("system" while rendering on the server) and a setter that applies it at once. */
export function useTheme() {
    const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);

    const setTheme = (next: Theme) => {
        let saved = true;
        try {
            if (next === "system") localStorage.removeItem(STORAGE_KEY);
            else localStorage.setItem(STORAGE_KEY, next);
        } catch {
            saved = false;
        }
        window.dispatchEvent(new Event(CHANGE_EVENT));
        // Storage blocked: the script fell back to the system theme, so apply the choice to this page directly
        if (!saved && next !== "system") document.documentElement.dataset.theme = next;
    };

    return { theme, setTheme };
}
