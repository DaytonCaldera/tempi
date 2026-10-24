"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { enqueue, listQueue, removeFromQueue, type PendingMove } from "@/lib/offline-queue";
import { MAX_SYNC_BATCH, type SyncResult } from "@/lib/offline-sync";
import type { MovementType, StockItem } from "@/types/models";

/** How often a non-empty queue tries to send while online (besides the moment the connection comes back). */
const RETRY_MS = 20_000;

const subscribeToOnline = (onChange: () => void) => {
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
    };
};

/** Whether the browser says it has a connection (always true while rendering on the server). */
export const useIsOnline = () => useSyncExternalStore(subscribeToOnline, () => navigator.onLine, () => true);

/** The stock with the queued moves applied on top, so the list shows what the runner did while offline. */
export function withPending<T extends Pick<StockItem<string>, "_id" | "quantity">>(items: T[], queue: PendingMove[]): T[] {
    if (queue.length === 0) return items;
    const delta = new Map<string, number>();
    for (const move of queue) delta.set(move.inventoryId, (delta.get(move.inventoryId) ?? 0) + (move.type === "IN" ? move.amount : -move.amount));
    return items.map(item => (delta.has(item._id) ? { ...item, quantity: Math.max(0, item.quantity + delta.get(item._id)!) } : item));
}

/**
 * The runner's offline queue (lib/offline-queue.ts): moves made without connection, sent to /api/runner/sync as
 * soon as there is one (and every RETRY_MS while some wait). `onSynced` gets the results, e.g. to refresh the stock
 * and look for held moves.
 */
export function useOfflineQueue(userEmail: string | null | undefined, onSynced: (results: SyncResult[]) => void) {
    const [queue, setQueue] = useState<PendingMove[]>([]);
    const [isSending, setIsSending] = useState(false);
    const isOnline = useIsOnline();
    const sending = useRef(false);
    const onSyncedRef = useRef(onSynced);
    useEffect(() => { onSyncedRef.current = onSynced; });

    const reload = useCallback(async () => {
        if (!userEmail) return;
        setQueue(await listQueue(userEmail).catch(() => []));
    }, [userEmail]);

    // What was left in the queue (a closed tab, a reload, the phone restarted)
    useEffect(() => {
        if (!userEmail) return;
        let active = true;
        listQueue(userEmail).catch(() => []).then(saved => { if (active) setQueue(saved); });
        return () => { active = false; };
    }, [userEmail]);

    const add = useCallback(async (move: { inventoryId: string; type: MovementType; amount: number; reason: string; productName: string; unit: string }) => {
        if (!userEmail) return null;
        const pending: PendingMove = { ...move, offlineId: crypto.randomUUID(), occurredAt: new Date().toISOString(), userEmail };
        await enqueue(pending);
        await reload();
        return pending;
    }, [userEmail, reload]);

    const cancel = useCallback(async (offlineId: string) => {
        await removeFromQueue([offlineId]);
        await reload();
    }, [reload]);

    /** Sends what is queued; what the server took (applied, held or invalid) leaves the queue. */
    const send = useCallback(async () => {
        if (!userEmail || sending.current || !navigator.onLine) return;
        const waiting = await listQueue(userEmail).catch(() => []);
        if (waiting.length === 0) return;
        sending.current = true;
        setIsSending(true);
        try {
            const moves = waiting.slice(0, MAX_SYNC_BATCH).map(({ offlineId, inventoryId, type, amount, reason, occurredAt }) => ({ offlineId, inventoryId, type, amount, reason, occurredAt }));
            const res = await fetch("/api/runner/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ moves }),
            }).catch(() => null);
            // No connection after all, signed out, or a server error: everything stays queued for the next try
            if (!res?.ok) return;
            const { results } = await res.json() as { results: SyncResult[] };
            // Every move sent was taken: applied, held for a decision, or left out as malformed (which would
            // otherwise block the queue forever)
            await removeFromQueue(moves.map(m => m.offlineId));
            await reload();
            onSyncedRef.current(results);
        } finally {
            sending.current = false;
            setIsSending(false);
        }
    }, [userEmail, reload]);

    // As soon as the connection is back, and every RETRY_MS while moves wait
    useEffect(() => {
        if (!isOnline || queue.length === 0) return;
        const first = setTimeout(send, 0);
        const timer = setInterval(send, RETRY_MS);
        return () => { clearTimeout(first); clearInterval(timer); };
    }, [isOnline, queue.length, send]);

    return { queue, isOnline, isSending, add, cancel, send };
}
