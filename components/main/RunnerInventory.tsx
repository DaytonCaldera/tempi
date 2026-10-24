"use client";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MapPin, X, AlertCircle, Undo2, ScanBarcode } from "lucide-react";
import useSWR, { useSWRConfig } from "swr";
import { useTranslations } from "next-intl";
import { fetcher, STOCK_REFRESH_INTERVAL } from "@/lib/fetcher";
import { MOVEMENT_REASONS } from "@/lib/constants";
import RunnerHeader from "@/components/main/runner/RunnerHeader";
import QuantityToolbar from "@/components/main/runner/QuantityToolbar";
import StockRow from "@/components/main/runner/StockRow";
import BarcodeScanner from "@/components/scanner/BarcodeScanner";
import PendingQueue from "@/components/main/runner/PendingQueue";
import HeldList from "@/components/held/HeldList";
import { Modal } from "@/components/ui/Modal";
import type { HeldView } from "@/lib/offline-sync-server";
import { useOfflineQueue, withPending } from "@/components/main/runner/useOfflineQueue";
import type { MovementType, StockItem } from "@/types/models";

type Item = StockItem<string>;

interface RunnerInventoryProps {
    initialItems: Item[];
    assignedAreaCount: number;
    /** Admins: an unknown barcode offers to create the product with it */
    canCreateProducts?: boolean;
    /** Whose offline queue this is (a shared phone keeps each runner's apart) */
    userEmail: string;
}

/** A completed move (that can be undone), an undone one, a move that failed, or a scanned code nothing has. */
type Toast =
    // queuedId: made without connection, still in the queue (undo cancels it)
    | { kind: 'moved'; item: Item; type: MovementType; amount: number; queuedId?: string }
    | { kind: 'undone'; productName: string }
    | { kind: 'error'; message: string }
    | { kind: 'notFound'; code: string; createHref: string | null };

const INVENTORY_KEY = '/api/admin/inventory';

/** How long the toast (and its Undo button) stays on screen. */
const TOAST_DURATION = 5000;

/** How long a product found by its barcode stays outlined. */
const HIGHLIGHT_DURATION = 4000;

/** Products a scanned (or typed + Enter) code is: by barcode, or by SKU ignoring case. */
const matchCode = (items: Item[], code: string) => {
    const sku = code.toLowerCase();
    return items.filter(item => item.barcode === code || item.sku?.toLowerCase() === sku);
};

/** Groups items by department, for the area chips and the department separators. */
const groupByDepartment = (items: Item[], fallbackName: string) =>
    Object.entries(items.reduce<Record<string, { name: string; items: Item[] }>>((groups, item) => {
        (groups[item.departmentId] ||= { name: item.departmentName || fallbackName, items: [] }).items.push(item);
        return groups;
    }, {})).map(([id, group]) => ({ id, ...group }));

/** Lowercase without accents, so "cafe" finds "Café" (product names are mostly Spanish). */
const normalizeText = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Whether the product shows for a search (already normalized). */
const matchesSearch = (item: Item, searchTerm: string) =>
    [item.productName, item.sku, item.barcode, item.departmentName].some(text => normalizeText(text || '').includes(searchTerm));

const setQuantity = (items: Item[] = [], id: string, quantity: (current: number) => number) =>
    items.map(item => item._id !== id ? item : { ...item, quantity: quantity(item.quantity) });

type MoveResult = { newQuantity: number };

/** The move didn't reach the server at all: no connection. It goes to the offline queue. */
class NetworkError extends Error {}

/** PATCHes the move; throws with the server's (translated) error message, or a NetworkError without connection. */
async function sendMove(id: string, type: MovementType, amount: number, reason: string): Promise<MoveResult> {
    const res = await fetch(`/api/admin/inventory/${id}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, type, reason })
    }).catch(() => null);
    if (!res) throw new NetworkError();
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error ?? "");
    return body;
}

export default function RunnerInventory({ initialItems, assignedAreaCount, canCreateProducts = false, userEmail }: RunnerInventoryProps) {
    const t = useTranslations('runner');
    const tCommon = useTranslations('common');

    const [search, setSearch] = useState("");
    const [globalQty, setGlobalQty] = useState(1);
    const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
    const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
    const [toast, setToast] = useState<Toast | null>(null);
    const [lastUpdated, setLastUpdated] = useState(() => Date.now());
    const [isScanning, setIsScanning] = useState(false);
    const [highlightId, setHighlightId] = useState<string | null>(null);

    // Polls so every runner sees stock changes made by others. The server just rendered fresh data,
    // so there's no fetch on mount: the first one comes with the interval or when the tab regains focus.
    const { data: serverItems = [], mutate, isValidating, error } = useSWR<Item[]>(INVENTORY_KEY, fetcher, {
        fallbackData: initialItems,
        revalidateOnMount: false,
        refreshInterval: STOCK_REFRESH_INTERVAL,
        revalidateOnFocus: true,
        onSuccess: () => setLastUpdated(Date.now()),
    });

    // The bound mutate can't take a mutation that resolves to something other than the list (the move result)
    const { mutate: mutateKey } = useSWRConfig();

    // Moves made without connection wait here, and show in the list on top of the server's stock
    const [isQueueOpen, setIsQueueOpen] = useState(false);
    // The runner's moves held when they synced, for them to decide (lib/offline-sync.ts)
    const [held, setHeld] = useState<HeldView[]>([]);
    const [isHeldOpen, setIsHeldOpen] = useState(false);
    const loadHeld = useCallback(async () => {
        const res = await fetch('/api/runner/held').catch(() => null);
        if (!res?.ok) return;
        const mine = (await res.json() as HeldView[]).filter(move => move.mine);
        setHeld(mine);
        return mine;
    }, []);
    const offline = useOfflineQueue(userEmail, async results => {
        mutate();
        // Something was held: show it right away, it's theirs to decide
        if (results.some(result => result.status === 'held') && (await loadHeld())?.length) setIsHeldOpen(true);
    });
    // Keeps this page working without connection (public/sw.js). Not in development: it would serve stale builds
    useEffect(() => {
        if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
        navigator.serviceWorker.register('/sw.js').catch(error => console.error('Service worker registration failed:', error));
    }, []);

    // Held moves from an earlier sync (another day, another tab)
    useEffect(() => {
        if (!offline.isOnline) return;
        const timer = setTimeout(loadHeld, 0);
        return () => clearTimeout(timer);
    }, [offline.isOnline, loadHeld]);
    const items = useMemo(() => withPending(serverItems, offline.queue), [serverItems, offline.queue]);

    // Each toast replaces the previous one and hides itself
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), TOAST_DURATION);
        return () => clearTimeout(timer);
    }, [toast]);

    // The product found by its code: bring it into view, then let the outline fade
    useEffect(() => {
        if (!highlightId) return;
        document.getElementById(`stock-${highlightId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const timer = setTimeout(() => setHighlightId(null), HIGHLIGHT_DURATION);
        return () => clearTimeout(timer);
    }, [highlightId]);

    const fallbackName = tCommon('general');
    const allDepartments = useMemo(() => groupByDepartment(items, fallbackName), [items, fallbackName]);
    // A filter for an area that no longer has stock shows everything
    const activeDepartment = allDepartments.some(d => d.id === departmentFilter) ? departmentFilter : null;

    // Filtering waits for typing to settle, so keystrokes stay responsive on long lists.
    // Memoized so a toast or a pending move doesn't re-filter the whole list.
    const deferredSearch = useDeferredValue(search);
    const departments = useMemo(() => {
        const searchTerm = normalizeText(deferredSearch.trim());
        const filteredItems = items.filter(item =>
            (!activeDepartment || item.departmentId === activeDepartment) &&
            matchesSearch(item, searchTerm)
        );
        return groupByDepartment(filteredItems, fallbackName);
    }, [items, activeDepartment, deferredSearch, fallbackName]);

    const setPending = (id: string, pending: boolean) => setPendingIds(ids => {
        const next = new Set(ids);
        if (pending) next.add(id); else next.delete(id);
        return next;
    });

    /** Puts a move in the offline queue; it shows in the list right away and is sent when the connection is back. */
    const queueMove = async (item: Item, type: MovementType, amount: number, reason: string) => {
        const pending = await offline.add({ inventoryId: item._id, type, amount, reason, productName: item.productName, unit: item.unit });
        return pending ? { queuedId: pending.offlineId } : false;
    };

    /**
     * Moves stock with an optimistic update. Without connection (or when the request can't reach the server) the
     * move is queued instead. Returns false when it was refused, else { queuedId } when it was queued.
     */
    const moveStock = async (item: Item, type: MovementType, amount: number, reason: string): Promise<false | { queuedId?: string }> => {
        const id = item._id;
        const delta = type === 'IN' ? amount : -amount;
        if (!navigator.onLine) return queueMove(item, type, amount, reason);
        setPending(id, true);
        try {
            // The server's balance goes into whatever the cache holds when it answers, so moves on other items aren't lost
            await mutateKey<Item[], MoveResult>(INVENTORY_KEY, sendMove(id, type, amount, reason), {
                optimisticData: current => setQuantity(current, id, quantity => Math.max(0, quantity + delta)),
                populateCache: (result, current) => setQuantity(current, id, () => result.newQuantity),
                rollbackOnError: true,
                revalidate: false,
            });
            return {};
        } catch (error) {
            if (error instanceof NetworkError) return queueMove(item, type, amount, reason);
            navigator.vibrate?.([40, 60, 40]);
            setToast({ kind: 'error', message: (error as Error).message || t('moveFailed') });
            mutate(); // Someone else may have changed the stock: show the real quantity
            return false;
        } finally {
            setPending(id, false);
        }
    };

    const handleMove = async (item: Item, type: MovementType) => {
        const amount = globalQty;
        if (amount < 1) return;
        const reason = type === 'OUT' ? MOVEMENT_REASONS.RUNNER_CONSUMPTION : MOVEMENT_REASONS.RESTOCK;
        const result = await moveStock(item, type, amount, reason);
        if (result) {
            navigator.vibrate?.(15); // A short buzz confirms the tap without looking (ignored where unsupported)
            setToast({ kind: 'moved', item, type, amount, queuedId: result.queuedId });
        }
    };

    // Rows are memoized: give them one callback that never changes but always runs the latest handleMove
    const handleMoveRef = useRef(handleMove);
    useEffect(() => { handleMoveRef.current = handleMove; });
    const onRowMove = useCallback((item: Item, type: MovementType) => handleMoveRef.current(item, type), []);

    const handleUndo = async (item: Item, type: MovementType, amount: number, queuedId?: string) => {
        setToast(null);
        // Still queued: it never reached the server, so undoing it is just not sending it
        if (queuedId) {
            await offline.cancel(queuedId);
            setToast({ kind: 'undone', productName: item.productName });
            return;
        }
        if (await moveStock(item, type === 'IN' ? 'OUT' : 'IN', amount, MOVEMENT_REASONS.CORRECTION)) {
            setToast({ kind: 'undone', productName: item.productName });
        }
    };

    /**
     * A code from the camera or a USB/Bluetooth scanner (Enter in the search). One product: clear the filters and
     * outline it, ready for −/+. Several (the same code in different areas): list just those. None: say so, and
     * offer admins to create it in the area they're looking at.
     */
    const handleCode = (raw: string) => {
        const code = raw.trim();
        if (!code) return;
        const matches = matchCode(items, code);
        if (matches.length === 1) {
            setSearch("");
            setDepartmentFilter(null);
            setToast(null);
            setHighlightId(matches[0]._id);
            return;
        }
        if (matches.length > 1) {
            setDepartmentFilter(null);
            setSearch(code);
            return;
        }
        navigator.vibrate?.([40, 60, 40]);
        const department = activeDepartment ?? (allDepartments.length === 1 ? allDepartments[0].id : null);
        setToast({
            kind: 'notFound',
            code,
            createHref: canCreateProducts
                ? department ? `/admin/departments/${department}/stock?barcode=${encodeURIComponent(code)}` : '/admin/departments'
                : null,
        });
    };

    // Enter in the search is a code when it is one, or when the search finds nothing (a scanner read an unknown
    // code). Otherwise typing a name and pressing Enter stays a plain search
    const handleSearchSubmit = (text: string) => {
        const code = text.trim();
        if (matchCode(items, code).length > 0 || !items.some(item => matchesSearch(item, normalizeText(code)))) handleCode(code);
    };

    const chipClass = (selected: boolean) =>
        `shrink-0 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border transition-all active:scale-95 ${selected ? 'bg-inverse border-inverse text-on-inverse' : 'bg-card border-line text-ink-muted'}`;

    return (
        <>
            <RunnerHeader
                assignedAreaCount={assignedAreaCount}
                sync={{ isValidating, hasError: !!error, lastUpdated }}
                pending={{ count: offline.queue.length, isSending: offline.isSending, onOpen: () => setIsQueueOpen(true) }}
                held={{ count: held.length, onOpen: () => setIsHeldOpen(true) }}
            />
            <Modal isOpen={isHeldOpen} onClose={() => setIsHeldOpen(false)} title={t('heldTitle', { count: held.length })}>
                <p className="mb-4 text-sm text-ink-muted">{t('heldIntro')}</p>
                <HeldList
                    held={held}
                    onResolved={async () => {
                        mutate();
                        if (!(await loadHeld())?.length) setIsHeldOpen(false);
                    }}
                />
            </Modal>
            <PendingQueue
                open={isQueueOpen}
                queue={offline.queue}
                isOnline={offline.isOnline}
                isSending={offline.isSending}
                onCancel={offline.cancel}
                onSend={offline.send}
                onClose={() => setIsQueueOpen(false)}
            />

            <QuantityToolbar
                quantity={globalQty}
                onQuantityChange={setGlobalQty}
                search={search}
                onSearchChange={setSearch}
                onSearchSubmit={handleSearchSubmit}
                onScan={() => setIsScanning(true)}
            />
            <BarcodeScanner open={isScanning} onClose={() => setIsScanning(false)} onDetected={handleCode} />

            <div className="max-w-md mx-auto px-4 pt-4 pb-24 space-y-6">
                {/* AREA FILTER: only worth showing with more than one area */}
                {allDepartments.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none]">
                        <button onClick={() => setDepartmentFilter(null)} aria-pressed={!activeDepartment} className={chipClass(!activeDepartment)}>
                            {t('allAreas')}
                        </button>
                        {allDepartments.map(department => (
                            <button
                                key={department.id}
                                onClick={() => setDepartmentFilter(department.id)}
                                aria-pressed={activeDepartment === department.id}
                                className={chipClass(activeDepartment === department.id)}
                            >
                                {department.name}
                            </button>
                        ))}
                    </div>
                )}

                {departments.map(department => (
                    <section key={department.id} aria-labelledby={`area-${department.id}`} className="space-y-2.5">
                        {/* DEPARTMENT SEPARATOR */}
                        <div className="flex items-center gap-3 px-1">
                            <MapPin size={14} className="text-ink-subtle shrink-0" aria-hidden />
                            <h2 id={`area-${department.id}`} className="text-[11px] font-black text-ink-muted uppercase tracking-[0.15em] select-none">
                                {department.name}
                            </h2>
                            <div className="h-px flex-1 bg-linear-to-r from-line to-transparent rounded-full"></div>
                        </div>

                        {department.items.map(item => (
                            <StockRow
                                key={item._id}
                                item={item}
                                quantity={globalQty}
                                isPending={pendingIds.has(item._id)}
                                isHighlighted={highlightId === item._id}
                                onMove={onRowMove}
                            />
                        ))}
                    </section>
                ))}

                {departments.length === 0 && (
                    <div className="text-center py-20 text-ink-subtle font-bold">{t('noProducts')}</div>
                )}
            </div>

            {/* TOAST: result of the last move, with Undo. Dark in both themes, so it stands out from the list */}
            <div aria-live="polite" className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center pointer-events-none">
                {toast && (
                    <div
                        role={toast.kind === 'error' ? 'alert' : 'status'}
                        className={`pointer-events-auto w-full max-w-md flex items-center gap-3 pl-5 pr-2 py-2 rounded-2xl shadow-2xl ${toast.kind === 'error' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-white ring-1 ring-white/10'}`}
                    >
                        {toast.kind === 'error' && <AlertCircle size={20} className="shrink-0" />}
                        {toast.kind === 'notFound' && <ScanBarcode size={20} className="shrink-0 text-amber-300" />}
                        <p className="flex-1 min-w-0 py-2 text-sm font-bold truncate">
                            {toast.kind === 'moved' && <><span className={toast.type === 'OUT' ? 'text-red-300' : 'text-green-300'}>{toast.type === 'OUT' ? '−' : '+'}{toast.amount}</span> {toast.item.productName}{toast.queuedId && <span className="font-normal text-white/70"> · {t('queued')}</span>}</>}
                            {toast.kind === 'undone' && t('undone', { product: toast.productName })}
                            {toast.kind === 'error' && toast.message}
                            {toast.kind === 'notFound' && t('codeNotFound', { code: toast.code })}
                        </p>
                        {toast.kind === 'moved' && (
                            <button
                                onClick={() => handleUndo(toast.item, toast.type, toast.amount, toast.queuedId)}
                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
                            >
                                <Undo2 size={14} /> {t('undo')}
                            </button>
                        )}
                        {toast.kind === 'notFound' && toast.createHref && (
                            <Link
                                href={toast.createHref}
                                className="shrink-0 px-4 py-2.5 rounded-xl bg-white/10 font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
                            >
                                {t('createProduct')}
                            </Link>
                        )}
                        <button onClick={() => setToast(null)} aria-label={t('dismiss')} className="p-2.5 rounded-xl text-white/60 hover:text-white">
                            <X size={16} />
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
