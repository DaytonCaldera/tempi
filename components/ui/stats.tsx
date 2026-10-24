import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import type { Metric, SeriesPoint } from "@/lib/series";

/**
 * Server components for numbers and charts: the organization dashboard and the superadmin panel.
 * Plain HTML and CSS, no client-side chart library; labels use the "stats" messages.
 */

export function Card({ title, children, className = "" }: { title?: React.ReactNode; children: React.ReactNode; className?: string }) {
    return (
        <section className={`rounded-3xl border border-line bg-card p-6 ${className}`}>
            {title && <h2 className="mb-4 text-sm font-semibold text-ink">{title}</h2>}
            {children}
        </section>
    );
}

/**
 * A number with its change against the previous period. `upIsGood` colors the change
 * (more closed organizations is bad news); the arrow and the sign carry it without color too.
 */
export async function StatTile({ label, metric, hint, upIsGood = true, display }: {
    label: string; metric: Metric; hint?: string; upIsGood?: boolean;
    /** Shown instead of the formatted value, e.g. a percentage */
    display?: string;
}) {
    const t = await getTranslations("stats");
    const format = await getFormatter();
    const diff = metric.previous === undefined ? null : metric.value - metric.previous;
    const tone = diff === null || diff === 0 ? "text-ink-subtle" : (diff > 0) === upIsGood ? "text-success" : "text-danger";
    const Icon = diff === null || diff === 0 ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight;

    return (
        <div className="rounded-3xl border border-line bg-card p-5">
            <p className="text-sm text-ink-muted">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{display ?? format.number(metric.value)}</p>
            {diff === null ? (
                <p className="mt-2 text-xs text-ink-subtle">{hint ?? t("notComparable")}</p>
            ) : (
                <p className={`mt-2 flex items-center gap-1 text-xs font-semibold ${tone}`}>
                    <Icon size={14} aria-hidden />
                    <span>{diff === 0 ? t("noChange") : `${diff > 0 ? "+" : "−"}${format.number(Math.abs(diff))}`}</span>
                    <span className="font-normal text-ink-subtle">{t("vsPrevious")}</span>
                </p>
            )}
        </div>
    );
}

/** Label of a bucket key from lib/series ("2026-10-23" or "2026-10-23T14:00"), already in the app's time zone. */
async function bucketLabel(bucket: string) {
    const format = await getFormatter();
    const [y, m, d] = bucket.slice(0, 10).split("-").map(Number);
    const day = format.dateTime(new Date(Date.UTC(y, m - 1, d, 12)), { day: "numeric", month: "short", timeZone: "UTC" });
    return bucket.length > 10 ? `${day} ${bucket.slice(11)}` : day;
}

/**
 * Columns of one series over time. Single series, so the title names it and there is no legend.
 * Each column's whole height is its hover/focus target and shows the exact value; the table below repeats the data.
 */
export async function BarChart({ title, points, unit }: { title: string; points: SeriesPoint[]; unit: "hour" | "day" }) {
    const t = await getTranslations("stats");
    const format = await getFormatter();
    const max = Math.max(...points.map(p => p.value), 0);
    const total = points.reduce((sum, p) => sum + p.value, 0);
    const labels = await Promise.all(points.map(p => bucketLabel(p.bucket)));

    return (
        <Card>
            <div className="mb-4 flex items-baseline justify-between gap-4">
                <h2 className="text-sm font-semibold text-ink">{title}</h2>
                <p className="text-xs text-ink-subtle">{unit === "hour" ? t("byHour") : t("byDay")} · {t("total", { count: format.number(total) })}</p>
            </div>

            <div className="flex gap-2">
                {/* Y axis: only the top and the baseline, the tooltip and table carry the rest */}
                <div className="flex h-40 flex-col justify-between text-right text-[10px] tabular-nums text-ink-subtle" aria-hidden>
                    <span>{format.number(max)}</span>
                    <span>0</span>
                </div>
                <div className="relative flex h-40 flex-1 items-end gap-[2px] border-b border-line" role="img" aria-label={`${title}: ${t("total", { count: total })}`}>
                    <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-line" aria-hidden />
                    {points.map((point, i) => (
                        <div key={point.bucket} tabIndex={0} className="group relative flex h-full flex-1 items-end justify-center outline-none">
                            <div
                                className="w-full max-w-6 rounded-t-[4px] bg-chart transition-opacity group-hover:opacity-80 group-focus:opacity-80"
                                style={{ height: max ? `max(${(point.value / max) * 100}%, ${point.value ? 2 : 0}px)` : 0 }}
                            />
                            <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-inverse px-2 py-1 text-xs text-on-inverse shadow group-hover:block group-focus:block">
                                {labels[i]}: <span className="font-semibold tabular-nums">{format.number(point.value)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="mt-1 flex justify-between pl-6 text-[10px] text-ink-subtle" aria-hidden>
                <span>{labels[0]}</span>
                <span>{labels[labels.length - 1]}</span>
            </div>

            <details className="mt-4 text-xs">
                <summary className="cursor-pointer font-semibold text-ink-muted hover:text-ink">{t("table")}</summary>
                <div className="mt-2 max-h-56 overflow-y-auto">
                    <table className="w-full text-left">
                        <thead><tr className="text-ink-subtle"><th className="py-1 font-semibold">{t("bucket")}</th><th className="py-1 text-right font-semibold">{t("count")}</th></tr></thead>
                        <tbody className="divide-y divide-line">
                            {points.map((point, i) => (
                                <tr key={point.bucket}><td className="py-1 text-ink-muted">{labels[i]}</td><td className="py-1 text-right tabular-nums text-ink">{format.number(point.value)}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>
        </Card>
    );
}
