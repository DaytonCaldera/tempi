"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

const AUTO = "auto";

// The browser's time zone, read only in the browser: the server's would show in the first render and mismatch
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const noSubscription = () => () => {};

/** "GMT-06:00" for a time zone, right now. */
const offsetLabel = (timeZone: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(new Date())
        .find(p => p.type === "timeZoneName")?.value ?? "";

/**
 * The time zone the user's dates show in: the browser's (automatic) or one they pick, e.g. when the device's own
 * is wrong. Saved in the account (PATCH /api/user/timezone), so it applies on every device.
 */
export default function TimeZoneSetting() {
    const t = useTranslations("account.preferences");
    const router = useRouter();
    const { data: session, update } = useSession();
    const [saving, setSaving] = useState(false);
    const browser = useSyncExternalStore(noSubscription, browserTimeZone, () => "");
    const selected = session?.user?.timeZone ?? AUTO;

    // A few hundred zones, listed only in the browser (once `browser` is set, after hydration): the server's time
    // zone data can differ from the browser's (zones, offsets), and the first render must match. Until then only
    // the chosen one shows
    const zones = useMemo(() => (browser ? Intl.supportedValuesOf("timeZone") : selected === AUTO ? [] : [selected])
        .map(zone => ({ zone, label: browser ? `${zone.replace(/_/g, " ")} (${offsetLabel(zone)})` : zone.replace(/_/g, " ") })),
    [browser, selected]);

    const change = async (value: string) => {
        setSaving(true);
        try {
            const res = await fetch("/api/user/timezone", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ timeZone: value === AUTO ? null : value }),
            });
            if (res.ok) {
                await update(); // The session carries the account's time zone
                router.refresh(); // Dates rendered on the server take it too
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <label htmlFor="account-timezone" className="text-sm font-semibold text-ink">{t("timeZone")}</label>
            <select
                id="account-timezone"
                value={selected}
                disabled={saving || !session}
                onChange={(e) => change(e.target.value)}
                className="w-full sm:w-80 bg-subtle border border-line rounded-xl px-3 py-2 text-xs font-semibold text-ink outline-none focus:border-accent disabled:opacity-50"
            >
                <option value={AUTO}>{t("timeZoneAuto", { zone: browser.replace(/_/g, " ") })}</option>
                {zones.map(({ zone, label }) => <option key={zone} value={zone}>{label}</option>)}
            </select>
        </div>
    );
}
