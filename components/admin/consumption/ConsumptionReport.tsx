"use client";
import { Download, Calendar, FileText, Printer, Info } from "lucide-react";
import { useConsumptionReport, type DateRange } from "./useConsumptionReport";
import { DepartmentReportTable } from "./DepartmentReportTable";
import { PrintableReport } from "./PrintableReport";

export interface ReportProps {
    /** Limit the report to one department; without it, all departments of the organization */
    deptId?: string;
    title?: string;
}

function DateInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    return (
        <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-2xl border border-brand/10 shadow-sm flex-1 sm:flex-none">
            <Calendar size={18} className="text-brand-accent" />
            <input
                type="datetime-local"
                className="bg-transparent text-sm font-black text-brand outline-none cursor-pointer"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}

/** Consumption report: stock at the start of a date range, ins and outs during it, and stock at the end. */
export default function ConsumptionReport({ deptId, title = "Reporte de Consumo" }: ReportProps) {
    const { range, setRange, data, loading, expandedId, details, toggleDetails } = useConsumptionReport(deptId);
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
                <div className="bg-white p-8 md:p-10 rounded-[3rem] border-2 border-brand/5 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-8">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-8 bg-brand-accent rounded-full" />
                            <h2 className="text-3xl md:text-4xl font-black text-black tracking-tighter uppercase">{title}</h2>
                        </div>
                        <p className="text-[11px] font-black text-brand/40 uppercase tracking-[0.3em] px-5">
                            {deptId ? "Filtro: Departamento Activo" : "Resumen Global de Movimientos"}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto bg-surface p-4 rounded-[2.5rem]">
                        <div className="flex flex-wrap items-center gap-4 flex-1">
                            <DateInput value={range.start} onChange={start => updateRange({ start })} />
                            <div className="hidden sm:block w-4 h-px bg-brand/10" />
                            <DateInput value={range.end} onChange={end => updateRange({ end })} />
                        </div>

                        <button
                            type="button"
                            onClick={handlePrint}
                            className="w-full sm:w-14 h-14 bg-white text-brand border border-brand/10 rounded-2xl flex items-center justify-center hover:scale-105 transition-all shadow-sm active:scale-95 group"
                            title="Imprimir reporte"
                        >
                            <Printer size={22} className="group-hover:scale-110 transition-transform" />
                        </button>

                        <button type="button" className="w-full sm:w-14 h-14 bg-brand text-brand-accent rounded-2xl flex items-center justify-center hover:scale-105 transition-all shadow-lg active:scale-95 group">
                            <Download size={24} className="group-hover:translate-y-1 transition-transform" />
                        </button>
                    </div>
                </div>

                {/* CONTENT */}
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center bg-white rounded-[3rem] border-2 border-brand/5 gap-6">
                        <div className="w-14 h-14 border-4 border-surface border-t-brand-accent rounded-full animate-spin" />
                        <span className="text-sm font-black text-brand/30 uppercase tracking-[0.2em]">Sincronizando Datos...</span>
                    </div>
                ) : data.length > 0 ? (
                    <div className="space-y-10">
                        {/* INFO BANNER */}
                        <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-6 flex flex-col md:flex-row gap-6">
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 text-blue-800">
                                    <FileText size={20} />
                                    <h3 className="font-black uppercase tracking-tight text-lg">Inventario Completo</h3>
                                </div>
                                <p className="text-sm text-blue-900/70 font-medium">
                                    Este es el inventario completo actualmente. Se muestran todos los artículos registrados en el departamento con su stock final disponible.
                                </p>
                            </div>
                            <div className="hidden md:block w-px bg-blue-100" />
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 text-brand">
                                    <Info size={20} />
                                    <h3 className="font-black uppercase tracking-tight text-lg">Consumo en Fechas</h3>
                                </div>
                                <p className="text-sm text-brand/70 font-medium">
                                    En las fechas que elegiste, este es el consumo que hubo. Detalla las entradas, salidas y el balance general durante ese periodo exacto.
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
                    <div className="h-64 flex flex-col items-center justify-center bg-white rounded-[3rem] border-2 border-brand/5 border-dashed gap-4">
                        <FileText size={48} className="text-brand/10" />
                        <p className="text-sm font-black text-brand/30 uppercase tracking-[0.2em]">No se encontraron artículos en este departamento</p>
                    </div>
                )}
            </div>

            {/* PRINT VIEW (hidden on screen) */}
            <PrintableReport title={title} range={range} data={data} showDepartmentNames={!deptId} />
        </div>
    );
}
