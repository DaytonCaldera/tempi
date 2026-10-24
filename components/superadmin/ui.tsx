import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Download, Minus, Search } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import type { Metric, SeriesPoint } from "@/lib/superadmin";

/**
 * Server components shared by the /superadmin pages. They render plain HTML (filters are GET forms and links),
 * so the panel needs no client-side data fetching.
 */

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
    return (
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
                <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
            </div>
            {children}
        </div>
    );
}

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
    const t = await getTranslations("superadmin.overview");
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

/** Label of a bucket key from lib/superadmin ("2026-10-23" or "2026-10-23T14:00"), already in the app's time zone. */
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
    const t = await getTranslations("superadmin.overview.charts");
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
                                className="w-full max-w-6 rounded-t-[4px] bg-accent transition-opacity group-hover:opacity-80 group-focus:opacity-80"
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

/**
 * Steps of a funnel as horizontal bars, each against the first step (one series, so no legend).
 * Bars and percentages carry the same numbers, so neither depends on the other.
 */
export async function FunnelChart({ steps }: { steps: { label: string; value: number }[] }) {
    const t = await getTranslations("superadmin.overview");
    const format = await getFormatter();
    const base = steps[0]?.value ?? 0;

    return (
        <ol className="space-y-3">
            {steps.map((step, i) => {
                const share = base ? step.value / base : 0;
                return (
                    <li key={step.label}>
                        <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
                            <span className="text-ink">{step.label}</span>
                            <span className="shrink-0 tabular-nums">
                                <span className="font-semibold text-ink">{format.number(step.value)}</span>
                                {i > 0 && base > 0 && <span className="ml-2 text-xs text-ink-subtle">{t("funnelOf", { percent: format.number(share, { style: "percent" }) })}</span>}
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-subtle">
                            <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.round(share * 100)}%` }} />
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

/** A row of links that set one query parameter, keeping the others (e.g. the period, or a filter). */
export function Segmented({ label, options, current, hrefFor }: {
    label: string; options: { value: string; label: string }[]; current: string; hrefFor: (value: string) => string;
}) {
    return (
        <nav aria-label={label} className="inline-flex flex-wrap items-center gap-0.5 rounded-full border border-line bg-card p-1">
            {options.map(option => {
                const selected = option.value === current;
                return (
                    <Link
                        key={option.value}
                        href={hrefFor(option.value)}
                        aria-current={selected ? "page" : undefined}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${selected ? "bg-inverse text-on-inverse" : "text-ink-muted hover:text-ink"}`}
                    >
                        {option.label}
                    </Link>
                );
            })}
        </nav>
    );
}

/** Search box as a GET form, so the results are a shareable URL. `keep` carries the other parameters. */
export async function SearchForm({ action, q, placeholder, keep = {} }: { action: string; q?: string; placeholder: string; keep?: Record<string, string> }) {
    const t = await getTranslations("superadmin");
    return (
        <form action={action} method="get" role="search" className="flex w-full max-w-md items-center gap-2 rounded-2xl border border-line bg-card px-4 py-2 focus-within:border-line-strong">
            <Search size={16} className="shrink-0 text-ink-subtle" aria-hidden />
            {Object.entries(keep).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
            <input name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle" />
            <button type="submit" className="text-xs font-semibold text-ink-muted hover:text-ink">{t("search")}</button>
        </form>
    );
}

export async function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (page: number) => string }) {
    if (pages <= 1) return null;
    const t = await getTranslations("superadmin.pagination");
    const link = "rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink hover:border-line-strong";
    return (
        <nav className="mt-6 flex items-center justify-between gap-4" aria-label={t("page", { page, pages })}>
            {page > 1 ? <Link href={hrefFor(page - 1)} className={link}>{t("previous")}</Link> : <span />}
            <span className="text-xs text-ink-subtle">{t("page", { page, pages })}</span>
            {page < pages ? <Link href={hrefFor(page + 1)} className={link}>{t("next")}</Link> : <span />}
        </nav>
    );
}

const BADGE_TONES = {
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-danger/10 text-danger",
    neutral: "bg-subtle text-ink-muted",
};

/** A status pill. The text says the state; the color only supports it. */
export function Badge({ tone, children }: { tone: keyof typeof BADGE_TONES; children: React.ReactNode }) {
    return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${BADGE_TONES[tone]}`}>{children}</span>;
}

/**
 * Downloads a registry as CSV (app/(superadmin)/superadmin/export/[kind]/route.ts) with the page's filters.
 * A plain link: the browser downloads the file, no client code needed.
 */
export async function ExportLink({ kind, params }: { kind: "organizations" | "users" | "audit"; params: Record<string, string | undefined> }) {
    const t = await getTranslations("superadmin");
    return (
        <a
            href={hrefWith(`/superadmin/export/${kind}`, params)}
            download
            className="inline-flex items-center gap-2 rounded-2xl border border-line bg-card px-4 py-2.5 text-xs font-semibold text-ink-muted hover:border-line-strong hover:text-ink"
        >
            <Download size={14} aria-hidden /> {t("exportCsv")}
        </a>
    );
}

/** Builds `path?…` from parameters, leaving out empty ones (and page 1). */
export function hrefWith(path: string, params: Record<string, string | number | undefined>) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === "" || (key === "page" && Number(value) <= 1)) continue;
        search.set(key, String(value));
    }
    const query = search.toString();
    return query ? `${path}?${query}` : path;
}
