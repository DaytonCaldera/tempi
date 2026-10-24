import { getDb } from "@/lib/api";
import { timeZone } from "@/i18n/config";

/**
 * Daily activity log ("user_activity" collection): one document per user per day they opened the app,
 * in the app's time zone. users.lastSeenAt only keeps the latest visit, so daily/weekly/monthly active
 * users are counted from here (see lib/superadmin-insights.ts).
 */

/** "YYYY-MM-DD" of a date in the app's time zone. */
export function dayKey(date: Date): string {
    // en-CA formats dates as YYYY-MM-DD
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Marks the user as active today. Idempotent: only the first call of the day writes. */
export async function recordDailyActivity(email: string, userId: string | undefined, now = new Date()) {
    const db = await getDb();
    await db.collection("user_activity").updateOne(
        { email: email.toLowerCase(), day: dayKey(now) },
        { $setOnInsert: { userId: userId ?? null, firstSeenAt: now } },
        { upsert: true }
    );
}
