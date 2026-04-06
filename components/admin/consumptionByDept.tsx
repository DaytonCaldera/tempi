"use client";
import React, { useEffect, useState } from "react";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/Datatable";
import { ArrowDownRight, ArrowUpRight, Calendar, ChevronDown, ChevronUp, Download, MapPin, Package } from "lucide-react";
import { ReportProps } from "./consumption";

interface GroupedConsumptionReportProps extends ReportProps {
    initialData?: any[];
}

export default function GroupedConsumptionReport({ initialData, deptId, title = 'Reporte de consumo por departamento' }: GroupedConsumptionReportProps) {

    const [data, setData] = useState(initialData || []);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [details, setDetails] = useState<any[]>([]);


    const [range, setRange] = useState({
        start: new Date().toISOString().split('T')[0] + "T00:00",
        end: new Date().toISOString().split('T')[0] + "T23:59"
    });

    const fetchReport = async () => {
        setLoading(true);
        let url = `/api/admin/reports/consumption?start=${range.start}&end=${range.end}`;
        if (deptId) url += `&deptId=${deptId}`;
        const res = await fetch(url);
        const result = await res.json();
        setData(result);
        setLoading(false);
    };

    useEffect(() => {
        if (range.start && range.end) fetchReport();
    }, [range, deptId]);

    const toggleDetails = async (id: string) => {
        if (expandedId === id) {
            setExpandedId(null);
            return;
        }
        setExpandedId(id);
        const res = await fetch(`/api/admin/reports/consumption/details?inventoryId=${id}&start=${range.start}&end=${range.end}`);
        const logData = await res.json();
        setDetails(logData);
    };


    const tableHeaders = [
        { title: "Producto" },
        { title: "Entradas" },
        { title: "Salidas" },
        { title: "Diferencia" }
    ]

    return (
        <div className="space-y-12">

            {/* 1. RESPONSIVE HEADER */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 md:p-8 rounded-4xl border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-[#171717] leading-tight">{title}</h2>
                    <p className="text-sm md:text-base font-bold text-gray-400 uppercase tracking-widest mt-2">
                        {deptId ? "Filtrado por departamento" : "Resumen Global"}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="flex flex-col sm:flex-row items-center gap-2 bg-gray-50 p-2 sm:px-4 sm:py-3 rounded-2xl border border-gray-100">
                        <Calendar size={20} className="text-gray-400 hidden sm:block" />
                        <input
                            type="datetime-local"
                            className="bg-transparent text-base font-bold outline-none cursor-pointer w-full"
                            value={range.start}
                            onChange={(e) => setRange({ ...range, start: e.target.value })}
                        />
                        <span className="text-gray-300 font-black hidden sm:block">→</span>
                        <input
                            type="datetime-local"
                            className="bg-transparent text-base font-bold outline-none cursor-pointer w-full"
                            value={range.end}
                            onChange={(e) => setRange({ ...range, end: e.target.value })}
                        />
                    </div>
                    <button className="flex items-center justify-center p-4 bg-[#171717] text-white rounded-2xl hover:bg-black transition-all shadow-xl active:scale-95">
                        <Download size={22} />
                    </button>
                </div>
            </div>

            {/* 2. MAIN CONTENT AREA */}
            {loading ? (
                <div className="h-64 flex flex-col items-center justify-center bg-white rounded-4xl border border-dashed border-gray-200 gap-4">
                    <div className="w-12 h-12 border-4 border-gray-200 border-t-[#171717] rounded-full animate-spin" />
                    <span className="text-lg font-bold text-gray-400">Generando Reporte...</span>
                </div>
            ) : data.length > 0 ? (
                <>
                    {data && data.map((dept) => (
                        <section key={dept._id} className="animate-in fade-in slide-in-from-bottom-4">
                            {/* Visual Divider / Header */}
                            <div className="flex items-center gap-4 mb-6 px-2">
                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm border border-blue-100">
                                    <MapPin size={24} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900 leading-none">
                                        {dept.departmentName}
                                    </h2>
                                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">
                                        Resumen de consumo del área
                                    </p>
                                </div>
                            </div>

                            {/* Table per Department - DESKTOP*/}
                            <div className="hidden md:block">
                                <DataTable headers={tableHeaders}>
                                    {dept.items.map((item: any, index: number) => (
                                        <React.Fragment key={index}>
                                            <DataTableRow onClick={() => toggleDetails(item.inventoryId)} className={expandedId === item.inventoryId ? "bg-blue-50/30" : ""}>
                                                <DataTableCell>
                                                    <div className="flex flex-col py-1">
                                                        <span className="text-base font-bold text-gray-900">{item.productName}</span>
                                                        <span className="text-sm font-mono text-blue-500 font-bold">{item.sku}</span>
                                                    </div>
                                                </DataTableCell>

                                                <DataTableCell>
                                                    <div className="text-base font-black text-green-600 bg-green-50/50 px-3 py-1 rounded-lg inline-block">
                                                        +{item.totalIn}
                                                    </div>
                                                </DataTableCell>

                                                <DataTableCell>
                                                    <div className="text-base font-black text-red-500 bg-red-50/50 px-3 py-1 rounded-lg inline-block">
                                                        -{item.totalOut}
                                                    </div>
                                                </DataTableCell>

                                                <DataTableCell className="text-right">
                                                    <span className={`text-lg font-black ${item.totalIn - item.totalOut < 0 ? 'text-orange-500' : 'text-gray-900'}`}>
                                                        {item.totalIn - item.totalOut > 0 ? `+${item.totalIn - item.totalOut}` : item.totalIn - item.totalOut}
                                                    </span>
                                                </DataTableCell>
                                            </DataTableRow>
                                            {expandedId === item.inventoryId && (
                                                <tr className="bg-gray-50/50">
                                                    <td colSpan={4} className="p-8">
                                                        <MovementDetailGrid details={details} />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </DataTable>

                            </div>

                            {/* MOBILE LIST (Visible only on small screens) */}
                            <div className="md:hidden space-y-4">
                                {dept.items.map((item: any) => (
                                    <div key={item.inventoryId} className="bg-white border border-gray-100 rounded-4xl p-6 shadow-sm overflow-hidden">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex flex-col">
                                                <span className="text-xl font-black text-[#171717]">{item.productName}</span>
                                                <span className="text-sm font-bold text-blue-600 uppercase mt-1">{item.sku}</span>
                                            </div>
                                            <button
                                                onClick={() => toggleDetails(item.inventoryId)}
                                                className="p-3 bg-gray-50 rounded-2xl"
                                            >
                                                {expandedId === item.inventoryId ? <ChevronUp /> : <ChevronDown />}
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div className="bg-green-50 p-4 rounded-2xl">
                                                <p className="text-[10px] font-black text-green-700 uppercase mb-1">Entradas</p>
                                                <p className="text-2xl font-black text-green-700">+{item.totalIn}</p>
                                            </div>
                                            <div className="bg-red-50 p-4 rounded-2xl">
                                                <p className="text-[10px] font-black text-red-700 uppercase mb-1">Salidas</p>
                                                <p className="text-2xl font-black text-red-700">-{item.totalOut}</p>
                                            </div>
                                        </div>
                                        {expandedId === item.inventoryId && (
                                            <div className="mt-6 pt-6 border-t border-gray-100">
                                                <MovementDetailGrid details={details} isMobile />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </>
            ) : (<>
                <div className="h-64 flex items-center justify-center bg-white rounded-4xl border border-dashed border-gray-200 text-lg text-gray-400 font-bold">
                    No se encontraron movimientos.
                </div>
            </>)}


        </div>
    );
}

// Sub-component to keep code clean
function MovementDetailGrid({ details, isMobile = false }: { details: any[], isMobile?: boolean }) {
    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
            <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Historial Detallado</p>
            <div className={`grid grid-cols-1 ${isMobile ? "" : "xl:grid-cols-2"} gap-4`}>
                {details.map((log: any) => (
                    <div key={log._id} className="flex items-center justify-between bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${log.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {log.type === 'IN' ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
                            </div>
                            <div>
                                <p className="text-lg font-black text-black">{log.amount} <span className="text-sm text-gray-400 font-medium">uds</span></p>
                                <p className="text-sm text-gray-500 font-bold">{log.user.name} • {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                        </div>
                        <span className="hidden sm:block text-sm font-bold text-gray-500 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">{log.reason}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}