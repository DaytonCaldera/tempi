"use client";
import React, { useState, useEffect } from "react";
import { Download, Calendar, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp, MapPin, FileText, Printer, Info } from "lucide-react";
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
    const [data, setData] = useState<any[]>([]);
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

    const handlePrint = (e: React.MouseEvent) => {
        e.preventDefault();
        setTimeout(() => {
            window.print();
        }, 100);
    };

    return (
        <div className="max-w-350 mx-auto pb-20 text-[1rem]">
            
            {/* =========================================
                MAGIA CSS PARA IMPRESIÓN COMPLETA
                Fuerza al navegador a mostrar todas las páginas
            ========================================= */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    html, body {
                        height: auto !important;
                        overflow: visible !important;
                    }
                    /* Resetea contenedores comunes de Next.js que bloquean la paginación */
                    body > div, main, section, article {
                        height: auto !important;
                        overflow: visible !important;
                        display: block !important;
                        position: static !important;
                    }
                }
            `}} />

            {/* =========================================
                VISTA DE PANTALLA (INTERACTIVA)
                Oculta al imprimir (print:hidden)
            ========================================= */}
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

                {/* CONTENT AREA */}
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

                        {data.map((dept: any) => (
                            <section key={dept._id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {!deptId && (
                                    <div className="flex items-center gap-4 mb-6 px-4">
                                        <div className="w-12 h-12 bg-brand text-brand-accent rounded-2xl flex items-center justify-center shadow-lg">
                                            <MapPin size={24} />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-black leading-none uppercase tracking-tighter">{dept.departmentName}</h2>
                                            <p className="text-[10px] font-black text-brand/40 uppercase tracking-widest mt-1">Inventario por ubicación</p>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                                    <DataTable headers={[
                                        { title: "Producto" }, 
                                        { title: "Inv. Inicial (Rango)" }, 
                                        { title: "Entradas" }, 
                                        { title: "Salidas" }, 
                                        { title: "Balance" },
                                        { title: "Inv. Actual (Final)" }
                                    ]}>
                                        {dept.items.map((item: any, index: number) => {
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
                                                            <span className="text-base font-bold text-gray-500">{item.initialQuantity}</span>
                                                        </DataTableCell>

                                                        <DataTableCell>
                                                            <span className="px-3 py-1 bg-success-dark/10 text-success-dark text-base font-black rounded-lg">+{item.totalIn}</span>
                                                        </DataTableCell>

                                                        <DataTableCell>
                                                            <span className="px-3 py-1 bg-danger/10 text-danger text-base font-black rounded-lg">-{item.totalOut}</span>
                                                        </DataTableCell>

                                                        <DataTableCell>
                                                            <span className={`text-lg font-black ${item.finalBalance < 0 ? 'text-danger' : 'text-black'}`}>
                                                                {item.finalBalance > 0 ? `+${item.finalBalance}` : item.finalBalance}
                                                            </span>
                                                        </DataTableCell>

                                                        <DataTableCell>
                                                            <div className="flex items-center justify-between w-full">
                                                                <span className="text-xl font-black text-brand-accent bg-brand px-3 py-1 rounded-lg">
                                                                    {item.finalQuantity}
                                                                </span>
                                                                <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-brand text-brand-accent' : 'text-brand/20'}`}>
                                                                    {isExpanded ? <ChevronUp size={20} strokeWidth={3} /> : <ChevronDown size={20} strokeWidth={3} />}
                                                                </div>
                                                            </div>
                                                        </DataTableCell>
                                                    </DataTableRow>
                                                    
                                                    {isExpanded && (
                                                        <tr>
                                                            <td colSpan={6} className="p-8 bg-surface/40">
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
                        <p className="text-sm font-black text-brand/30 uppercase tracking-[0.2em]">No se encontraron artículos en este departamento</p>
                    </div>
                )}
            </div>

            {/* =========================================
                VISTA DE IMPRESIÓN PANTALLA COMPLETA
                Oculta en pantalla (hidden print:block)
            ========================================= */}
            <div className="hidden print:block w-full text-black font-sans bg-white">
                <div className="mb-8 border-b-2 border-black pb-4">
                    <h1 className="text-3xl font-black uppercase tracking-tight">{title}</h1>
                    <p className="text-[1rem] font-bold mt-2 text-gray-700">
                        Rango de fechas: {new Date(range.start).toLocaleString()} — {new Date(range.end).toLocaleString()}
                    </p>
                    <p className="text-[1rem] mt-1 text-gray-600">
                        Generado el: {new Date().toLocaleString()}
                    </p>
                </div>

                {data.length > 0 ? (
                    data.map((dept: any) => (
                        <div key={`print-${dept._id}`} className="mb-12">
                            {!deptId && (
                                <h2 className="text-xl font-black uppercase bg-gray-100 p-3 mb-4 rounded-md">
                                    Departamento: {dept.departmentName}
                                </h2>
                            )}
                            
                            {/* TABLA NATIVA PARA IMPRESIÓN PERFECTA */}
                            <table className="w-full text-left border-collapse text-[1rem]">
                                <thead>
                                    <tr className="border-b-2 border-black text-sm uppercase tracking-wider">
                                        <th className="py-3 px-2 font-black">SKU</th>
                                        <th className="py-3 px-2 font-black">Producto</th>
                                        <th className="py-3 px-2 font-black text-center">Inv. Inicial</th>
                                        <th className="py-3 px-2 font-black text-center">Entradas</th>
                                        <th className="py-3 px-2 font-black text-center">Salidas</th>
                                        <th className="py-3 px-2 font-black text-center">Balance</th>
                                        <th className="py-3 px-2 font-black text-center">Inv. Final</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dept.items.map((item: any, idx: number) => (
                                        <tr key={idx} className="border-b border-gray-300 break-inside-avoid">
                                            <td className="py-3 px-2 font-medium text-gray-600">{item.sku}</td>
                                            <td className="py-3 px-2 font-bold">{item.productName}</td>
                                            <td className="py-3 px-2 text-center text-gray-600">{item.initialQuantity}</td>
                                            <td className="py-3 px-2 text-center font-bold text-green-700">+{item.totalIn}</td>
                                            <td className="py-3 px-2 text-center font-bold text-red-700">-{item.totalOut}</td>
                                            <td className="py-3 px-2 text-center font-bold">
                                                {item.finalBalance > 0 ? `+${item.finalBalance}` : item.finalBalance}
                                            </td>
                                            <td className="py-3 px-2 text-center font-black bg-gray-50">{item.finalQuantity}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))
                ) : (
                    <p className="text-[1rem] font-bold text-center mt-10">No hay datos disponibles para imprimir en este rango.</p>
                )}
            </div>
            
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
                {details.length === 0 ? (
                    <p className="text-sm font-bold text-brand/40 p-4">No hay movimientos en las fechas seleccionadas.</p>
                ) : (
                    details.map((log: any) => (
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
                                        {log.user?.name || 'Sistema'} • {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                            <div className="px-4 py-2 bg-surface text-brand/60 text-[10px] font-black uppercase tracking-wider rounded-xl">
                                {log.reason || 'Sin justificación'}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}