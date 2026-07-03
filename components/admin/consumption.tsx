"use client";
import React, { useState, useEffect } from "react";
import { Download, Calendar, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp, MapPin, FileText, Printer } from "lucide-react";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/Datatable";

export interface ReportProps {
    deptId?: string;
    title?: string;
}

const getLocalDatetimeStr = (date: Date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    return localISOTime;
};

export default function ConsumptionReport({ deptId, title = "Reporte de Consumo" }: ReportProps) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [details, setDetails] = useState<any[]>([]);

    const [range, setRange] = useState({
        start: getLocalDatetimeStr(new Date(new Date().setHours(0, 0, 0, 0))),
        end: getLocalDatetimeStr(new Date(new Date().setHours(23, 59, 59, 999)))
    });

    const fetchReport = async () => {
        setLoading(true);
        try {
            const startUTC = new Date(range.start).toISOString();
            const endUTC = new Date(range.end).toISOString();
            let url = `/api/admin/reports/consumption?start=${startUTC}&end=${endUTC}`;
            if (deptId) url += `&deptId=${deptId}`;

            const res = await fetch(url);
            const result = await res.json();
            setData(result);
        } catch (error) {
            console.error("Error fetching report:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (range.start && range.end) fetchReport();
    }, [range, deptId]);

    const toggleDetails = async (inventoryId: string) => {
        if (expandedId === inventoryId) {
            setExpandedId(null);
            return;
        }
        setExpandedId(inventoryId);
        const startUTC = new Date(range.start).toISOString();
        const endUTC = new Date(range.end).toISOString();
        const res = await fetch(`/api/admin/reports/consumption/details?inventoryId=${inventoryId}&start=${startUTC}&end=${endUTC}`);
        const logData = await res.json();
        setDetails(logData);
    };

    // NEW: triggers the browser's native print dialog (works for "Guardar como PDF" también)
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-8 max-w-350 mx-auto pb-20">
            
            {/* 1. HEADER & FILTER HUB */}
            <div className="bg-white p-8 md:p-10 rounded-[3rem] border-2 border-brand/5 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-8 print:hidden">
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
                        <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-2xl border border-brand/10 shadow-sm flex-1 sm:flex-none">
                            <Calendar size={18} className="text-brand-accent" />
                            <input
                                type="datetime-local"
                                className="bg-transparent text-sm font-black text-brand outline-none cursor-pointer"
                                value={range.start}
                                onChange={(e) => setRange({ ...range, start: e.target.value })}
                            />
                        </div>

                        <div className="hidden sm:block w-4 h-px bg-brand/10" />

                        <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-2xl border border-brand/10 shadow-sm flex-1 sm:flex-none">
                            <Calendar size={18} className="text-brand-accent" />
                            <input
                                type="datetime-local"
                                className="bg-transparent text-sm font-black text-brand outline-none cursor-pointer"
                                value={range.end}
                                onChange={(e) => setRange({ ...range, end: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* NEW: print button, same visual style as the existing download button */}
                    <button
                        onClick={handlePrint}
                        className="w-full sm:w-14 h-14 bg-white text-brand border border-brand/10 rounded-2xl flex items-center justify-center hover:scale-105 transition-all shadow-sm active:scale-95 group"
                        title="Imprimir reporte"
                    >
                        <Printer size={22} className="group-hover:scale-110 transition-transform" />
                    </button>

                    <button className="w-full sm:w-14 h-14 bg-brand text-brand-accent rounded-2xl flex items-center justify-center hover:scale-105 transition-all shadow-lg active:scale-95 group">
                        <Download size={24} className="group-hover:translate-y-1 transition-transform" />
                    </button>
                </div>
            </div>

            {/* NEW: print-only header, shows the title and the date range as static text since inputs are hidden when printing */}
            <div className="hidden print:block mb-6">
                <h2 className="text-2xl font-black text-black uppercase tracking-tight">{title}</h2>
                <p className="text-xs font-bold text-gray-500 mt-1">
                    Rango: {new Date(range.start).toLocaleString()} — {new Date(range.end).toLocaleString()}
                </p>
            </div>

            {/* 2. CONTENT AREA */}
            {loading ? (
                <div className="h-64 flex flex-col items-center justify-center bg-white rounded-[3rem] border-2 border-brand/5 gap-6 print:hidden">
                    <div className="w-14 h-14 border-4 border-surface border-t-brand-accent rounded-full animate-spin" />
                    <span className="text-sm font-black text-brand/30 uppercase tracking-[0.2em]">Sincronizando Datos...</span>
                </div>
            ) : data.length > 0 ? (
                <div className="space-y-10">
                    {data.map((dept: any) => (
                        <section key={dept._id} className="animate-in fade-in slide-in-from-bottom-4 duration-500 print:break-inside-avoid">
                            {!deptId && (
                                <div className="flex items-center gap-4 mb-6 px-4">
                                    <div className="w-12 h-12 bg-brand text-brand-accent rounded-2xl flex items-center justify-center shadow-lg print:hidden">
                                        <MapPin size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-black leading-none uppercase tracking-tighter">{dept.departmentName}</h2>
                                        <p className="text-[10px] font-black text-brand/40 uppercase tracking-widest mt-1 print:hidden">Inventario por ubicación</p>
                                    </div>
                                </div>
                            )}

                            <div className="bg-white rounded-xl overflow-hidden">
                                <DataTable headers={[{ title: "Producto" }, { title: "Entradas" }, { title: "Salidas" }, { title: "Balance" }]}>
                                    {dept.items.map((item: any, index: number) => {
                                        const balance = item.totalIn - item.totalOut;
                                        const isExpanded = expandedId === item.inventoryId;

                                        return (
                                            <React.Fragment key={index}>
                                                <DataTableRow 
                                                    onClick={() => toggleDetails(item.inventoryId)} 
                                                    className={`cursor-pointer transition-colors ${isExpanded ? "bg-surface" : "hover:bg-surface/30"}`}
                                                >
                                                    <DataTableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-lg font-black text-black tracking-tight">{item.productName}</span>
                                                            <span className="text-[11px] font-black text-brand bg-brand/5 w-fit px-2 py-0.5 rounded-md mt-1 tracking-wider uppercase">{item.sku}</span>
                                                        </div>
                                                    </DataTableCell>
                                                    <DataTableCell>
                                                        <span className="px-4 py-2 bg-success-dark/10 text-success-dark text-base font-black rounded-xl">+{item.totalIn}</span>
                                                    </DataTableCell>
                                                    <DataTableCell>
                                                        <span className="px-4 py-2 bg-danger/10 text-danger text-base font-black rounded-xl">-{item.totalOut}</span>
                                                    </DataTableCell>
                                                    <DataTableCell>
                                                        <div className="flex items-center justify-between w-full">
                                                            <span className={`text-xl font-black ${balance < 0 ? 'text-danger' : 'text-black'}`}>
                                                                {balance > 0 ? `+${balance}` : balance}
                                                            </span>
                                                            <div className={`p-2 rounded-lg transition-colors print:hidden ${isExpanded ? 'bg-brand text-brand-accent' : 'text-brand/20'}`}>
                                                                {isExpanded ? <ChevronUp size={20} strokeWidth={3} /> : <ChevronDown size={20} strokeWidth={3} />}
                                                            </div>
                                                        </div>
                                                    </DataTableCell>
                                                </DataTableRow>
                                                
                                                {isExpanded && (
                                                    <tr className="print:hidden">
                                                        <td colSpan={4} className="p-8 bg-surface/40">
                                                            <MovementDetailGrid details={details} />
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </DataTable>
                            </div>
                        </section>
                    ))}
                </div>
            ) : (
                <div className="h-64 flex flex-col items-center justify-center bg-white rounded-[3rem] border-2 border-brand/5 border-dashed gap-4">
                    <FileText size={48} className="text-brand/10" />
                    <p className="text-sm font-black text-brand/30 uppercase tracking-[0.2em]">No se detectaron movimientos en este rango</p>
                </div>
            )}
        </div>
    );
}

function MovementDetailGrid({ details }: { details: any[] }) {
    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-1.5 h-4 bg-brand rounded-full" />
                <p className="text-xs font-black text-brand uppercase tracking-[0.2em]">Historial de Movimientos Recientes</p>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {details.map((log: any) => (
                    <div key={log._id} className="flex items-center justify-between bg-white p-5 rounded-3xl shadow-sm hover:shadow-lg transition-all">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black bg-brand text-brand-accent`}>
                                {log.type === 'IN' ? <ArrowUpRight size={24} strokeWidth={3} /> : <ArrowDownRight size={24} strokeWidth={3} />}
                            </div>
                            <div>
                                <p className="text-xl font-black text-black leading-tight">
                                    {log.amount} <span className="text-xs text-brand/30 uppercase font-black">unidades</span>
                                </p>
                                <p className="text-[11px] text-brand/60 font-black uppercase tracking-tighter">
                                    {log.user.name} • {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                        <div className="px-4 py-2 bg-surface text-brand/60 text-[10px] font-black uppercase tracking-wider rounded-xl">
                            {log.reason}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}