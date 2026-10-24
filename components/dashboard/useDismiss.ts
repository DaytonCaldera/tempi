'use client';
import { useEffect, type RefObject } from "react";

/** Calls `close` on a click outside `ref` or on Escape, while `isOpen` (the navbar's dropdowns). */
export function useDismiss(ref: RefObject<HTMLElement | null>, isOpen: boolean, close: () => void) {
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) close();
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") close();
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKey);
        };
    }, [ref, isOpen, close]);
}
