// Service worker: keeps the runner page usable without connection (registered by components/main/RunnerInventory).
// - The runner page (/runner) and its stock list (GET /api/admin/inventory): network first, the last copy when
//   there is no connection. Moves made meanwhile go to the page's own offline queue (lib/offline-queue.ts).
// - Next's build files (/_next/static, content-hashed: they never change): cache first.
// - Everything else (other pages, every other API, any non-GET): straight to the network, never cached.
// Signing out deletes these caches (clearOfflineCache in lib/offline-queue.ts), so the next person on the phone can't
// see them offline.

const VERSION = "v1";
const PAGES = `runner-pages-${VERSION}`;
const STATIC = `runner-static-${VERSION}`;

self.addEventListener("install", (event) => {
    // The runner page registers this worker: keep it, its stock and the build files it loads now (they loaded before
    // this worker existed), so it opens offline from then on
    event.waitUntil((async () => {
        const pages = await caches.open(PAGES);
        const statics = await caches.open(STATIC);
        for (const path of ["/runner", "/api/admin/inventory"]) {
            try {
                const response = await fetch(path, { credentials: "same-origin" });
                if (!response.ok || response.redirected) continue;
                if (path === "/runner") {
                    const html = await response.clone().text();
                    const files = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) ?? [])];
                    await Promise.all(files.map(file => statics.add(file).catch(() => {})));
                }
                await pages.put(path, response);
            } catch {
                // Offline while installing: the first visit online fills it
            }
        }
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", (event) => {
    // Old versions' caches go
    event.waitUntil((async () => {
        const keep = new Set([PAGES, STATIC]);
        for (const name of await caches.keys()) if (name.startsWith("runner-") && !keep.has(name)) await caches.delete(name);
        await self.clients.claim();
    })());
});

const isRunnerPage = (url, request) => request.mode === "navigate" && url.pathname === "/runner";
const isRunnerStock = (url) => url.pathname === "/api/admin/inventory";
const isBuildFile = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");

/** The network's answer, kept for later; the kept one when the network fails. */
async function networkFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    try {
        const response = await fetch(request);
        // Only real pages and data: not redirects to sign-in, not errors
        if (response.ok && !response.redirected) await cache.put(request, response.clone());
        return response;
    } catch (error) {
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        throw error;
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(STATIC);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
}

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (isRunnerPage(url, request) || isRunnerStock(url)) event.respondWith(networkFirst(request, PAGES));
    else if (isBuildFile(url)) event.respondWith(cacheFirst(request));
});

