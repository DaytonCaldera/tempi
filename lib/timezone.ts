/**
 * Time zones. Dates are stored in UTC; each person sees and picks them in their own time zone: the one set in their
 * account, else the one their browser reports (TIMEZONE_COOKIE, kept current by components/TimeZoneSync), else
 * the app's default (i18n/config.ts). i18n/request.ts resolves it for every request. Shared by browser and server.
 */

/** Holds the time zone the browser reports, for people who didn't set one in their account. */
export const TIMEZONE_COOKIE = "NEXT_TIMEZONE";

/** Whether `value` is an IANA time zone this runtime knows ("America/Costa_Rica", "Europe/Madrid", "UTC"...). */
export function isTimeZone(value: unknown): value is string {
    if (typeof value !== "string" || !value || value.length > 64) return false;
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: value });
        return true;
    } catch {
        return false;
    }
}

/** Year, month, day, hour, minute and second of `date` on the clocks of `timeZone`. */
function zonedParts(date: Date, timeZone: string) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
        timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(date).map(p => [p.type, Number(p.value)]));
    return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute, second: parts.second };
}

/** How far ahead of UTC the clocks of `timeZone` are at `date`, in ms (negative in the Americas). */
function offsetMs(date: Date, timeZone: string) {
    const p = zonedParts(date, timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The instant a wall-clock time ("2026-10-24T13:30", as a datetime-local input gives it) is in `timeZone`.
 * Times skipped by a daylight saving change land an hour later; repeated ones take the first.
 */
export function zonedToUtc(local: string, timeZone: string): Date {
    const [date, time = "00:00"] = local.split("T");
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute, second = 0] = time.split(":").map(Number);
    const wall = Date.UTC(year, month - 1, day, hour, minute, second);
    // The two offsets around the time (they differ only near a DST change) give the candidate instants
    const first = wall - offsetMs(new Date(wall), timeZone);
    const candidate = wall - offsetMs(new Date(first), timeZone);
    // A candidate is right when the zone's clocks read `local` at it; a repeated time has two: take the earlier
    const valid = [first, candidate].filter(t => wall - t === offsetMs(new Date(t), timeZone));
    if (valid.length > 0) return new Date(Math.min(...valid));
    // No instant shows that time (skipped when clocks spring forward): the one an hour later
    return new Date(Math.max(first, candidate));
}

/** `date` as a datetime-local value ("2026-10-24T13:30") on the clocks of `timeZone`. */
export function toZonedInput(date: Date, timeZone: string) {
    const p = zonedParts(date, timeZone);
    return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Today in `timeZone`, from 00:00 to 23:59, as datetime-local values. */
export function zonedToday(timeZone: string, now = new Date()) {
    const day = toZonedInput(now, timeZone).slice(0, 10);
    return { start: `${day}T00:00`, end: `${day}T23:59` };
}

/**
 * The UTC range a report covers for two datetime-local values in `timeZone`. The end minute is included whole
 * (23:59 runs to 23:59:59.999), so nothing done in the last minute of the day is left out.
 */
export function zonedRange(start: string, end: string, timeZone: string) {
    return { start: zonedToUtc(start, timeZone), end: new Date(zonedToUtc(end, timeZone).getTime() + 59_999) };
}
