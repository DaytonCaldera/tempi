"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTimeZone } from "next-intl";
import { TIMEZONE_COOKIE } from "@/lib/timezone";

/**
 * Keeps TIMEZONE_COOKIE on the browser's time zone, so dates show in the person's local time (lib/timezone.ts).
 * When it changes (first visit, or travelling) the page renders again with it. People who set a time zone in
 * their account keep that one: the cookie is still updated, but it isn't used for them.
 */
export default function TimeZoneSync() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const current = useTimeZone();

    useEffect(() => {
        if (status === "loading") return;
        const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (!browser) return;
        const saved = document.cookie.split("; ").find(c => c.startsWith(`${TIMEZONE_COOKIE}=`))?.split("=")[1];
        if (decodeURIComponent(saved ?? "") === browser) return;
        document.cookie = `${TIMEZONE_COOKIE}=${encodeURIComponent(browser)}; path=/; max-age=31536000; samesite=lax`;
        // Only re-render when the dates on screen would change
        if (!session?.user?.timeZone && current !== browser) router.refresh();
    }, [status, session?.user?.timeZone, current, router]);

    return null;
}
