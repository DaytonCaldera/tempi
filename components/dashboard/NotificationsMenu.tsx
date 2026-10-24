'use client';
import { useSession } from "next-auth/react";
import { AlertTriangle, Bell, CheckCircle2, CloudOff, Hand } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useFormatter, useTranslations } from "next-intl";
import { labelOf } from "@/i18n/labels";
import { fetcher } from "@/lib/fetcher";
import { listQueue } from "@/lib/offline-queue";
import { useDismiss } from "@/components/dashboard/useDismiss";
import type { NotificationsData } from "@/lib/notifications";

/** How often the bell looks again (and whenever the tab regains focus, as SWR does) */
const REFRESH_INTERVAL = 60_000;

/**
 * The navbar's bell: what needs attention right now, worked out live (lib/notifications.ts) with nothing to mark
 * as read. Each item disappears once its cause is gone: held moves decided, queued moves sent, stock back above
 * its minimum.
 */
export default function NotificationsMenu() {
    const t = useTranslations("notifications");
    const tUnits = useTranslations("units");
    const format = useFormatter();
    const { data: session } = useSession();
    const email = session?.user?.email;
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const close = useCallback(() => setIsOpen(false), []);
    useDismiss(menuRef, isOpen, close);

    const { data } = useSWR<NotificationsData>(email ? "/api/notifications" : null, fetcher, { refreshInterval: REFRESH_INTERVAL });
    // Moves made offline in this browser that the runner hasn't sent yet (lib/offline-queue.ts)
    const { data: queued = 0 } = useSWR(email ? ["offline-queue", email] : null, ([, user]) => listQueue(user).then(queue => queue.length).catch(() => 0), { refreshInterval: REFRESH_INTERVAL });

    const held = data?.held ?? 0;
    const lowStock = data?.lowStock ?? { total: 0, items: [] };
    const count = held + queued + lowStock.total;
    const amount = (value: number, unit: string) => `${format.number(value)} ${unit ? labelOf(tUnits, unit).toLowerCase() : ""}`.trim();

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(open => !open)}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-label={count > 0 ? t("labelWithCount", { count }) : t("label")}
                className={`p-3 rounded-xl transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${isOpen ? "text-ink bg-subtle" : "text-ink-subtle hover:text-ink hover:bg-subtle"}`}
            >
                <Bell size={20} />
                {count > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-accent text-on-accent text-[10px] font-bold border-2 border-canvas">
                        {count > 99 ? "99+" : count}
                    </span>
                )}
            </button>

            <div
                role="menu"
                className={`absolute right-0 top-full mt-3 w-80 max-w-[calc(100vw-2rem)] origin-top-right transition-all duration-200 ${isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"}`}
            >
                <div className="bg-card border border-line rounded-2xl p-2 shadow-2xl">
                    <p className="px-3 py-2.5 text-sm font-semibold text-ink">{t("title")}</p>
                    <div className="my-1 border-t border-line" />

                    {count === 0 ? (
                        <p className="flex items-center gap-2 px-3 py-4 text-sm text-ink-muted">
                            <CheckCircle2 size={16} className="text-success" aria-hidden /> {t("empty")}
                        </p>
                    ) : (
                        <div className="max-h-[70vh] overflow-y-auto">
                            {held > 0 && (
                                <Item href="/dashboard" onClick={close} icon={<Hand size={16} className="text-warning" />} title={t("held", { count: held })} hint={t("heldHint")} />
                            )}
                            {queued > 0 && (
                                <Item href="/runner" onClick={close} icon={<CloudOff size={16} className="text-warning" />} title={t("queued", { count: queued })} hint={t("queuedHint")} />
                            )}

                            {lowStock.total > 0 && (
                                <>
                                    <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">{t("lowStock", { count: lowStock.total })}</p>
                                    {lowStock.items.map(item => (
                                        <Item
                                            key={item._id}
                                            href={item.href}
                                            onClick={close}
                                            icon={<AlertTriangle size={16} className={item.quantity <= 0 ? "text-danger" : "text-warning"} />}
                                            title={item.productName}
                                            hint={`${item.departmentName} · ${item.quantity <= 0 ? t("outOfStock") : t("left", { amount: amount(item.quantity, item.unit), minimum: amount(item.minStock, item.unit) })}`}
                                        />
                                    ))}
                                    {lowStock.total > lowStock.items.length && (
                                        <Link href="/dashboard" onClick={close} role="menuitem" className="block px-3 py-2 text-xs font-semibold text-accent hover:underline">
                                            {t("more", { count: lowStock.total - lowStock.items.length })}
                                        </Link>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Item({ href, onClick, icon, title, hint }: { href: string; onClick: () => void; icon: React.ReactNode; title: string; hint: string }) {
    return (
        <Link href={href} onClick={onClick} role="menuitem" className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-subtle transition-colors">
            <span className="mt-0.5 shrink-0" aria-hidden>{icon}</span>
            <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{title}</span>
                <span className="block text-xs text-ink-subtle">{hint}</span>
            </span>
        </Link>
    );
}
