"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import HeldList from "@/components/held/HeldList";
import type { HeldView } from "@/lib/offline-sync-server";

/**
 * The dashboard's held moves: the viewer's own, and for admins the ones a runner left undecided for
 * HOLD_ESCALATE_MS (lib/offline-sync.ts). Deciding one renders the dashboard again.
 */
export default function HeldCard({ held }: { held: HeldView[] }) {
    const t = useTranslations("held");
    const router = useRouter();

    return (
        <section className="rounded-3xl border border-warning/40 bg-card p-6">
            <h2 className="text-sm font-semibold text-ink">{t("dashboardTitle", { count: held.length })}</h2>
            <p className="mb-4 mt-1 text-xs text-ink-muted">{t("dashboardIntro")}</p>
            <HeldList held={held} showRunner onResolved={() => router.refresh()} />
        </section>
    );
}
