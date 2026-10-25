"use client";
import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { PERMISSIONS } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";
import { Modal } from "@/components/ui/Modal";

/** Body of an API error response. Plan errors come from planLimitError / planFeatureError (lib/plans.ts). */
type ErrorBody = { error?: string; code?: string };

/**
 * For admin forms: shows the plan errors (code "planLimit" / "planFeature") in a dialog that leads to the plan
 * page, instead of a bare alert that leaves the admin stuck.
 *
 * @example
 * const { handlePlanError, planDialog } = usePlanLimitDialog();
 * if (!handlePlanError(data)) alert(data.error);
 * return <>{...}{planDialog}</>;
 */
export function usePlanLimitDialog() {
    const t = useTranslations("plan.limitDialog");
    const [message, setMessage] = useState<string | null>(null);
    const { data: session } = useSession();
    const canManagePlan = hasPermission(session, PERMISSIONS.MANAGE_USERS);

    /** Opens the dialog and returns true when `data` is a plan error; false for any other error. */
    const handlePlanError = (data: ErrorBody) => {
        if (data.code !== "planLimit" && data.code !== "planFeature") return false;
        setMessage(data.error ?? "");
        return true;
    };

    const planDialog = (
        <Modal isOpen={message !== null} onClose={() => setMessage(null)} title={t("title")}
            // The plan page needs MANAGE_USERS: other roles (e.g. a manager) only read the message
            footer={canManagePlan ? (
                <Link href="/admin/plan" className="flex w-full items-center justify-center gap-2 rounded-3xl bg-accent py-4 text-sm font-semibold uppercase tracking-widest text-on-accent hover:brightness-110">
                    <Sparkles size={16} aria-hidden /> {t("seePlans")}
                </Link>
            ) : undefined}
        >
            <p className="text-sm leading-relaxed text-ink-muted">{message}</p>
        </Modal>
    );

    return { handlePlanError, planDialog };
}
