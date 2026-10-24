import { MOVEMENT_REASONS } from "@/lib/constants";

/** The part of a next-intl translator these helpers need. */
type Translator = { (key: string): string; has(key: string): boolean };

/** Translates a value read from the DB (a role, a unit, ...), or shows it as-is when it has no message. */
export const labelOf = (t: Translator, value: string) => (t.has(value) ? t(value) : value);

/** Name of a plan with the "plan" messages: catalog plans by key (plan.names.*), custom plans as they were named. */
export const planLabel = (t: Translator, plan: { key?: string | null; isCustom?: boolean; name: string }) =>
    plan.key && !plan.isCustom && t.has(`names.${plan.key}`) ? t(`names.${plan.key}`) : plan.name;

/**
 * Name of a plan feature with the "pricing" messages. Plans from before the catalog (not yet migrated by
 * scripts/seed-plans.js) store free text like "Reportes básicos": shown as written.
 */
export const featureLabel = (t: Translator, feature: string) =>
    t.has(`features.${feature}`) ? t(`features.${feature}`) : feature;

/**
 * Translates a stored stock movement reason with the "movementReasons" messages.
 * Reasons typed by hand are shown as they were written.
 */
export function movementReasonLabel(t: Translator, reason: string | undefined) {
    if (!reason) return t("none");
    const key = Object.keys(MOVEMENT_REASONS).find(k => MOVEMENT_REASONS[k as keyof typeof MOVEMENT_REASONS] === reason);
    return key ? t(key) : reason;
}
