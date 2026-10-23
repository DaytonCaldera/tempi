import { getDb } from "@/lib/api";
import type { User } from "@/types/models";

/**
 * How long a user document read by the session stays cached in this server process.
 * The session re-reads the user on every request (see the jwt callback in auth.ts), and polling pages make
 * that a query every few seconds per user. With the cache, role changes and deactivations made from another
 * server process apply within this time instead of on the next request.
 */
const USER_CACHE_TTL_MS = 15_000;
const USER_CACHE_MAX_ENTRIES = 1000;

const cache = new Map<string, { user: User | null; expiresAt: number }>();

/**
 * The user with that email.
 * @param fresh skip the cache, for sign-in and session updates (e.g. right after switching organization).
 */
export async function findUserByEmail(email: string | null | undefined, { fresh = false } = {}) {
    if (!email) return null;

    const cached = cache.get(email);
    if (!fresh && cached && cached.expiresAt > Date.now()) return cached.user;

    const db = await getDb();
    const user = await db.collection<User>('users').findOne({ email });

    // Maps keep insertion order: drop the oldest entry when full
    if (!cache.has(email) && cache.size >= USER_CACHE_MAX_ENTRIES) {
        cache.delete(cache.keys().next().value!);
    }
    cache.set(email, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
    return user;
}

/** Call after changing user documents, so this process sees the change on the next request. */
export function forgetCachedUsers() {
    cache.clear();
}
