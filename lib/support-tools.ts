import { SUPPORT_REASON_MIN_LENGTH } from "@/lib/constants";

/**
 * Server only: shared by the superadmin's server actions (organizations/[id]/actions.ts, plans/actions.ts).
 * They live here because a "use server" file may only export server actions.
 */

/** The reason the superadmin typed, or null when it is too short to say anything useful. */
export const readReason = (form: FormData) => {
    const reason = String(form.get("reason") ?? "").trim();
    return reason.length >= SUPPORT_REASON_MIN_LENGTH ? reason.slice(0, 500) : null;
};

/**
 * Runs a tool and turns an unexpected failure into a message instead of a silent click.
 * requireSuperadmin() stays outside: its redirect is thrown, and must not be caught.
 */
export async function guarded<T extends { error?: string }>(name: string, run: () => Promise<T>): Promise<T> {
    try {
        return await run();
    } catch (error) {
        console.error(`Superadmin tool ${name} failed:`, error);
        return { error: "invalid" } as T;
    }
}
