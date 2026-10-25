"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Calls POST /api/billing/subscription and refreshes the page on success (the server components read the new
 * subscription). `run` resolves to the response body, or null when it failed (`error` says why).
 */
export function useSubscriptionAction() {
    const router = useRouter();
    const t = useTranslations("plan.page");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const run = async (body: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
        setBusy(true);
        setError(null);
        try {
            const res = await fetch("/api/billing/subscription", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.error || t("actionFailed"));
                return null;
            }
            router.refresh();
            return data;
        } catch {
            setError(t("actionFailed"));
            return null;
        } finally {
            setBusy(false);
        }
    };

    return { run, busy, error, clearError: () => setError(null) };
}
