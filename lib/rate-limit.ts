/**
 * Counts attempts per key (e.g. a user id) in a time window, in this server process's memory.
 * Enough to stop guessing from one account; with several instances each one counts on its own.
 */
export function createRateLimiter({ max, windowMs }: { max: number; windowMs: number }) {
    const attempts = new Map<string, { count: number; resetAt: number }>();

    return {
        /** Whether the key already used up its attempts in the current window. */
        isLimited(key: string): boolean {
            const entry = attempts.get(key);
            return !!entry && entry.resetAt > Date.now() && entry.count >= max;
        },
        /** Records one attempt for the key. */
        hit(key: string) {
            const now = Date.now();
            const entry = attempts.get(key);
            if (!entry || entry.resetAt <= now) {
                // Drop expired keys now and then, so the map can't grow forever
                if (attempts.size > 10_000) {
                    for (const [k, e] of attempts) if (e.resetAt <= now) attempts.delete(k);
                }
                attempts.set(key, { count: 1, resetAt: now + windowMs });
            } else {
                entry.count++;
            }
        },
    };
}
