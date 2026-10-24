"use client";
import Link from "next/link";
import { Download, Calendar, FileText, Printer, Info, Lock } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useConsumptionReport, type DateRange } from "./useConsumptionReport";
import { DepartmentReportTable } from "./DepartmentReportTable";
import { PrintableReport } from "./PrintableReport";

export interface ReportProps {
    /** Limit the report to one department; without it, all departments of the organization */
    deptId?: string;
    title?: string;
    /** Whether the organization's plan includes the CSV export (PLAN_FEATURES.EXPORT_CSV) */
    canExport?: boolean;
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
export default function ConsumptionReport({ deptId, title: titleProp, canExport = false }: ReportProps) {
    const t = useTranslations("reports");
    const tPlan = useTranslations("plan");
    const format = useFormatter();
    const title = titleProp ?? t("title");
    const { range, setRange, data, loading, limitedFrom, exportUrl, expandedId, details, toggleDetails } = useConsumptionReport(deptId);
    const updateRange = (changes: Partial<DateRange>) => setRange({ ...range, ...changes });

    const handlePrint = (e: React.MouseEvent) => {
        e.preventDefault();
        setTimeout(() => window.print(), 100);
    };

    return (
        <div className="max-w-350 mx-auto pb-20 text-[1rem]">
            {/* SCREEN VIEW (hidden when printing) */}
            <div className="space-y-8 print:hidden">
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

                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto bg-subtle p-4 rounded-3xl">
                        <div className="flex flex-wrap items-center gap-4 flex-1">
                            <DateInput value={range.start} onChange={start => updateRange({ start })} />
                            <div className="hidden sm:block w-4 h-px bg-line-strong" />
                            <DateInput value={range.end} onChange={end => updateRange({ end })} />
                        </div>

                        <button
                            type="button"
                            onClick={handlePrint}
                            className="w-full sm:w-14 h-14 bg-card text-ink border border-line rounded-2xl flex items-center justify-center hover:scale-105 transition-all active:scale-95 group"
                            title={t("print")}
                        >
                            <Printer size={22} className="group-hover:scale-110 transition-transform" />
                        </button>

                        {canExport ? (
                            <a href={exportUrl ?? undefined} download title={t("download")} aria-label={t("download")} className="w-full sm:w-14 h-14 bg-inverse text-on-inverse rounded-2xl flex items-center justify-center hover:scale-105 transition-all active:scale-95 group">
                                <Download size={24} className="group-hover:translate-y-1 transition-transform" />
                            </a>
                        ) : (
                            // Not in the plan: shown locked, and it leads to the plan page instead of hiding the feature
                            <Link href="/admin/plan" title={tPlan("locked.export")} aria-label={tPlan("locked.export")} className="relative w-full sm:w-14 h-14 bg-card text-ink-subtle border border-line border-dashed rounded-2xl flex items-center justify-center hover:text-ink transition-colors">
                                <Download size={22} />
                                <span className="absolute -top-2 -right-2 flex items-center gap-0.5 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase text-on-accent">
                                    <Lock size={9} aria-hidden /> Pro
                                </span>
                            </Link>
                        )}
                    </div>
                </div>

                {limitedFrom && (
                    <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-5 py-3 text-sm text-ink">
                        <Info size={16} className="text-warning" aria-hidden />
                        {tPlan("historyLimited", { date: format.dateTime(limitedFrom, { dateStyle: "medium" }) })}
                        <Link href="/admin/plan" className="font-semibold text-accent underline-offset-2 hover:underline">{tPlan("upgradeShort")}</Link>
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

                        {data.map(department => (
                            <DepartmentReportTable
                                key={department._id}
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

            {/* PRINT VIEW (hidden on screen) */}
            <PrintableReport title={title} range={range} data={data} showDepartmentNames={!deptId} />
        </div>
    );
}
