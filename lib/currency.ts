import type { Organization } from "@/types/models";

/**
 * The currency an organization's costs are in (Organization.currency). Shared by the browser and the server.
 * Costs are plain numbers in that currency: there is no conversion, changing it only changes how they show.
 */

/** Currencies the organization can pick, by ISO 4217 code. Latin America first: most organizations are there. */
export const CURRENCIES = ["USD", "CRC", "MXN", "GTQ", "HNL", "NIO", "PAB", "DOP", "COP", "PEN", "CLP", "ARS", "UYU", "BOB", "PYG", "EUR"] as const;
export type Currency = typeof CURRENCIES[number];

export const DEFAULT_CURRENCY: Currency = "USD";

export const isCurrency = (value: unknown): value is Currency => typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);

export const currencyOf = (organization: Pick<Organization, "currency"> | null | undefined): Currency =>
    isCurrency(organization?.currency) ? organization.currency : DEFAULT_CURRENCY;

/** The unit cost a movement keeps (StockMovement.unitCost): nothing for products without a cost. */
export const costSnapshot = (unitCost: number | null | undefined) => (unitCost !== null && unitCost !== undefined ? { unitCost } : {});

/**
 * An amount of money typed by a person: "1500", "1.5", "1,5", "1.500", "1.500,50" or "₡1,500.50". Currency signs
 * and spaces are ignored. With both "." and ",", the last one is the decimal separator. With only one kind, it
 * separates thousands when it repeats ("1.500.000") or has exactly 3 digits after it ("1.500", "1,500"), unless
 * the whole part is 0 ("0.125", a cost per gram); otherwise it is the decimal separator ("1,5", "12.75").
 */
function parseNumber(text: string) {
    let raw = text.replace(/[^\d.,-]/g, "");
    const separators = raw.match(/[.,]/g) ?? [];
    const kinds = new Set(separators);
    const last = Math.max(raw.lastIndexOf("."), raw.lastIndexOf(","));
    const thousandsOnly = kinds.size === 1 && last !== -1 && (
        separators.length > 1 || (raw.length - last - 1 === 3 && !/^-?0$/.test(raw.slice(0, last)))
    );
    if (thousandsOnly) raw = raw.replace(/[.,]/g, "");
    else if (last !== -1) raw = raw.slice(0, last).replace(/[.,]/g, "") + "." + raw.slice(last + 1);
    return raw && /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : NaN;
}

/**
 * A cost per unit as stored: a number from 0 up, rounded to 4 decimals (costs of things sold by the gram).
 * null when empty, false when it isn't one.
 */
export function normalizeCost(value: unknown): number | null | false {
    if (value === null || value === undefined || value === "") return null;
    const cost = typeof value === "number" ? value : parseNumber(String(value));
    if (!Number.isFinite(cost) || cost < 0 || cost > 1_000_000_000) return false;
    return Math.round(cost * 10_000) / 10_000;
}
