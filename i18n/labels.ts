import { MOVEMENT_REASONS } from "@/lib/constants";

/** The part of a next-intl translator these helpers need. */
type Translator = { (key: string): string; has(key: string): boolean };

/** Translates a value read from the DB (a role, a unit, ...), or shows it as-is when it has no message. */
export const labelOf = (t: Translator, value: string) => (t.has(value) ? t(value) : value);

/**
 * Translates a stored stock movement reason with the "movementReasons" messages.
 * Reasons typed by hand are shown as they were written.
 */
export function movementReasonLabel(t: Translator, reason: string | undefined) {
    if (!reason) return t("none");
    const key = Object.keys(MOVEMENT_REASONS).find(k => MOVEMENT_REASONS[k as keyof typeof MOVEMENT_REASONS] === reason);
    return key ? t(key) : reason;
}
