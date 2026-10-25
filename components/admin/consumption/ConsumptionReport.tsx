"use client";
import Link from "next/link";
import { Download, Calendar, FileText, Info } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { PERMISSIONS } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";
import { useConsumptionReport, type DateRange, type ReportFormat } from "./useConsumptionReport";
import { DepartmentReportTable } from "./DepartmentReportTable";

/** The files the report downloads as, in every plan (lib/report-export.ts) */
const DOWNLOADS: { format: ReportFormat; label: string }[] = [
    { format: "pdf", label: "PDF" },
    { format: "xlsx", label: "Excel" },
    { format: "csv", label: "CSV" },
];

export interface ReportProps {
    /** Limit the report to one department; without it, all departments of the organization */
    deptId?: string;
    title?: string;
    /** The organization's currency, for the value of what was consumed */
    currency: string;
}

function DateInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    return (
        <div className="flex items-center gap-3 px-4 py-2 bg-card rounded-2xl border border-line flex-1 sm:flex-none">
            <Calendar size={18} className="text-accent" />
            <input
                type="datetime-local"
                className="bg-transparent text-sm font-semibold text-ink outline-none cursor-pointer"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}

/** Consumption report: stock at the start of a date range, ins and outs during it, and stock at the end. */
export default function ConsumptionReport({ deptId, title: titleProp, currency }: ReportProps) {
    const t = useTranslations("reports");
    const tPlan = useTranslations("plan");
    // The plan page needs MANAGE_USERS: a role that only sees reports gets no links to it
    const { data: session } = useSession();
    const canManagePlan = hasPermission(session, PERMISSIONS.MANAGE_USERS);
    const format = useFormatter();
    const title = titleProp ?? t("title");
    const { range, setRange, data, loading, limitedFrom, exportUrl, expandedId, details, toggleDetails } = useConsumptionReport(deptId);
    const updateRange = (changes: Partial<DateRange>) => setRange({ ...range, ...changes });

    return (
        <div className="max-w-350 mx-auto pb-20 text-[1rem]">
            <div className="space-y-8">
                {/* HEADER & FILTERS */}
                <div className="bg-card p-8 md:p-10 rounded-3xl border border-line flex flex-col xl:flex-row xl:items-center justify-between gap-8">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-8 bg-accent rounded-full" />
                            <h2 className="text-3xl md:text-4xl font-semibold text-ink tracking-tight">{title}</h2>
                        </div>
                        <p className="text-[11px] font-semibold text-ink-subtle uppercase tracking-[0.2em] px-5">
                            {deptId ? t("filterDepartment") : t("globalSummary")}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:flex-wrap items-center gap-4 w-full xl:w-auto bg-subtle p-4 rounded-3xl">
                        <div className="flex flex-wrap items-center gap-4 flex-1">
                            <DateInput value={range.start} onChange={start => updateRange({ start })} />
                            <div className="hidden sm:block w-4 h-px bg-line-strong" />
                            <DateInput value={range.end} onChange={end => updateRange({ end })} />
                        </div>

                        <div role="group" aria-label={t("download")} className="flex w-full sm:w-auto gap-2">
                            {DOWNLOADS.map(({ format, label }) => {
                                const url = exportUrl(format);
                                return (
                                    <a
                                        key={format}
                                        href={url ?? undefined}
                                        aria-disabled={!url}
                                        download
                                        title={t("downloadAs", { format: label })}
                                        className={`h-14 flex-1 sm:flex-none px-4 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold transition-all hover:scale-105 active:scale-95 group ${format === "pdf" ? "bg-inverse text-on-inverse" : "bg-card text-ink border border-line"} ${url ? "" : "pointer-events-none opacity-50"}`}
                                    >
                                        <Download size={18} aria-hidden className="group-hover:translate-y-0.5 transition-transform" />
                                        {label}
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {limitedFrom && (
                    <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-5 py-3 text-sm text-ink">
                        <Info size={16} className="text-warning" aria-hidden />
                        {tPlan("historyLimited", { date: format.dateTime(limitedFrom, { dateStyle: "medium" }) })}
                        {canManagePlan && <Link href="/admin/plan" className="font-semibold text-accent underline-offset-2 hover:underline">{tPlan("upgradeShort")}</Link>}
                    </p>
                )}

                {/* CONTENT */}
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center bg-card rounded-3xl border border-line gap-6">
                        <div className="w-14 h-14 border-4 border-line border-t-accent rounded-full animate-spin" />
                        <span className="text-sm font-semibold text-ink-subtle uppercase tracking-[0.2em]">{t("loading")}</span>
                    </div>
                ) : data.length > 0 ? (
                    <div className="space-y-10">
                        {/* INFO BANNER */}
                        <div className="bg-accent/10 border border-accent/20 rounded-3xl p-6 flex flex-col md:flex-row gap-6">
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 text-accent">
                                    <FileText size={20} />
                                    <h3 className="font-semibold uppercase tracking-tight text-lg">{t("fullInventoryTitle")}</h3>
                                </div>
                                <p className="text-sm text-ink-muted font-medium">
                                    {t("fullInventoryDescription")}
                                </p>
                            </div>
                            <div className="hidden md:block w-px bg-accent/20" />
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 text-ink">
                                    <Info size={20} />
                                    <h3 className="font-semibold uppercase tracking-tight text-lg">{t("rangeTitle")}</h3>
                                </div>
                                <p className="text-sm text-ink-muted font-medium">
                                    {t("rangeDescription")}
                                </p>
                            </div>
                        </div>

                        {/* What everything consumed in the range cost, all departments together */}
                        {data.length > 1 && (
                            <p className="px-4 text-sm text-ink-muted">
                                {t.rich("totalConsumedValue", {
                                    value: format.number(data.reduce((sum, d) => sum + d.items.reduce((s, i) => s + i.consumedValue, 0), 0), { style: "currency", currency, currencyDisplay: "narrowSymbol" }),
                                    b: (chunks) => <span className="text-lg font-semibold text-ink">{chunks}</span>,
                                })}
                            </p>
                        )}

                        {data.map(department => (
                            <DepartmentReportTable
                                key={department._id}
                                currency={currency}
                                department={department}
                                showDepartmentName={!deptId}
                                expandedId={expandedId}
                                details={details}
                                onToggleDetails={toggleDetails}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="h-64 flex flex-col items-center justify-center bg-card rounded-3xl border border-line border-dashed gap-4">
                        <FileText size={48} className="text-ink-subtle" />
                        <p className="text-sm font-semibold text-ink-subtle uppercase tracking-[0.2em]">{t("noItems")}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
