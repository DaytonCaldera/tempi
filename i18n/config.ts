/**
 * Locale settings shared by the server (i18n/request.ts) and the client (LanguageSwitcher).
 * There are no /[locale] routes: the chosen locale lives in the NEXT_LOCALE cookie.
 */

export const locales = ["es", "en"] as const;
export type Locale = (typeof locales)[number];

/** Used when there is no cookie and the browser asks for no supported language. */
export const defaultLocale: Locale = "es";

/** Dates and times are shown in the organization's timezone, not the viewer's. */
export const timeZone = "America/Costa_Rica";

export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Each language's name in that language, for the switcher. */
export const localeNames: Record<Locale, string> = {
    es: "Español",
    en: "English",
};

export const isLocale = (value: unknown): value is Locale =>
    typeof value === "string" && (locales as readonly string[]).includes(value);

/** First supported language in an Accept-Language header ("en-US,en;q=0.9,es;q=0.8" -> "en"). */
export function matchAcceptLanguage(header: string | null): Locale | undefined {
    if (!header) return undefined;
    const requested = header
        .split(",")
        .map(part => {
            const [tag, q] = part.trim().split(";q=");
            return { language: tag.split("-")[0].toLowerCase(), quality: q ? Number(q) : 1 };
        })
        .sort((a, b) => b.quality - a.quality);
    return requested.map(r => r.language).find(isLocale);
}
