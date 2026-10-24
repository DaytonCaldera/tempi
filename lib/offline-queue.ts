import type { QueuedMove } from "@/lib/offline-sync";

/**
 * Browser only: the runner's moves made without connection, kept in IndexedDB until /api/runner/sync takes them
 * (components/main/runner/useOfflineQueue.ts). They survive closing the tab or the phone running out of battery.
 * Each one is stored with who made it: on a shared phone, each runner only sends and sees their own.
 */

/** A queued move with what the runner needs to show it while it waits. */
export type PendingMove = QueuedMove & { userEmail: string; productName: string; unit: string };

const DB_NAME = "vitalliz-runner";
const STORE = "queue";

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "offlineId" });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/** Runs one request on the queue store and resolves with its result once the transaction is done. */
async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
    const db = await openDb();
    try {
        return await new Promise<T | undefined>((resolve, reject) => {
            const transaction = db.transaction(STORE, mode);
            const request = run(transaction.objectStore(STORE));
            transaction.oncomplete = () => resolve(request ? request.result : undefined);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally {
        db.close();
    }
}

/** The user's queued moves, oldest first. */
export async function listQueue(userEmail: string): Promise<PendingMove[]> {
    const all = (await withStore<PendingMove[]>("readonly", store => store.getAll())) ?? [];
    return all
        .filter(move => move.userEmail.toLowerCase() === userEmail.toLowerCase())
        .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
}

export async function enqueue(move: PendingMove) {
    await withStore("readwrite", store => store.put(move));
}

/**
 * Forgets the runner page and stock public/sw.js kept for offline use, on sign out: the next person on the phone
 * mustn't see them. The queue stays: its moves belong to who made them and are sent when they sign in again.
 */
export async function clearOfflineCache() {
    if (typeof caches === "undefined") return;
    for (const name of await caches.keys().catch(() => [])) if (name.startsWith("runner-")) await caches.delete(name).catch(() => {});
}

export async function removeFromQueue(offlineIds: string[]) {
    if (offlineIds.length === 0) return;
    await withStore("readwrite", store => { for (const id of offlineIds) store.delete(id); });
}
