"use client";
import { useState, useEffect } from "react";
import { Download, Calendar, ArrowUpRight, ArrowDownRight, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/Datatable";
import React from "react";

interface ReportProps {
    deptId?: string;
    title?: string;
}

export default function ConsumptionReport({ deptId, title = "Reporte de Consumo" }: ReportProps) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [details, setDetails] = useState<any[]>([]);

    const toggleDetails = async (id: string) => {
        if (expandedId === id) {
            setExpandedId(null);
            return;
        }
        setExpandedId(id);
        const res = await fetch(`/api/admin/reports/consumption/details?inventoryId=${id}&start=${range.start}&end=${range.end}`);
        const data = await res.json();
        setDetails(data);
    };

    // Default range: Today from 00:00 to 23:59
    const [range, setRange] = useState({
        start: new Date().toISOString().split('T')[0] + "T00:00",
        end: new Date().toISOString().split('T')[0] + "T23:59"
    });

    const fetchReport = async () => {
        setLoading(true);
        // We build the URL dynamically
        let url = `/api/admin/reports/consumption?start=${range.start}&end=${range.end}`;
        if (deptId) url += `&deptId=${deptId}`;

        const res = await fetch(url);
        const result = await res.json();
        setData(result);
        setLoading(false);
    };

    // Auto-fetch when range or deptId changes
    useEffect(() => {
        if (range.start && range.end) {
            fetchReport();
        }
    }, [range, deptId]);

    const tableHeaders = [
        { title: "Producto" },
        { title: "Entradas" },
        { title: "Salidas" },
        { title: "Diferencia" }
    ]

    return (
        <div className="space-y-8">
            {/* HEADER - Increased padding and font sizes */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-black text-[#171717]">{title}</h2>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-2">
                        {deptId ? "Filtrado por departamento" : "Resumen Global de Inventario"}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                        <Calendar size={18} className="text-gray-400" />
                        <input 
                            type="datetime-local" 
                            className="bg-transparent text-sm font-bold outline-none cursor-pointer"
                            value={range.start}
                            onChange={(e) => setRange({...range, start: e.target.value})}
                        />
                        <span className="text-gray-300 font-bold">→</span>
                        <input 
                            type="datetime-local" 
                            className="bg-transparent text-sm font-bold outline-none cursor-pointer"
                            value={range.end}
                            onChange={(e) => setRange({...range, end: e.target.value})}
                        />
                    </div>
                    <button className="p-3.5 bg-[#171717] text-white rounded-xl hover:bg-black transition-all shadow-md">
                        <Download size={20} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center bg-white rounded-3xl border border-dashed border-gray-200 text-lg text-gray-400 font-bold animate-pulse">
                    Generando reporte...
                </div>
            ) : data.length > 0 ? (
                <DataTable headers={tableHeaders}>
                    {data.map((item: any) => (
                        <React.Fragment key={item._id}>
                            <DataTableRow
                                onClick={() => toggleDetails(item._id)}
                                className={`${expandedId === item._id ? "bg-blue-50/40" : ""}`}
                            >
                                <DataTableCell>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-base font-bold text-[#171717] leading-tight">
                                            {item.productName}
                                        </span>
                                        <span className="text-sm font-mono text-blue-600 font-bold tracking-tight">
                                            {item.sku}
                                        </span>
                                    </div>
                                </DataTableCell>

                                <DataTableCell>
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl font-black text-base">
                                        <ArrowUpRight size={18} strokeWidth={3} />
                                        {item.totalIn}
                                    </div>
                                </DataTableCell>

                                <DataTableCell>
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-xl font-black text-base">
                                        <ArrowDownRight size={18} strokeWidth={3} />
                                        {item.totalOut}
                                    </div>
                                </DataTableCell>

                                <DataTableCell>
                                    <div className="flex items-center justify-between">
                                        <span className={`text-lg font-black ${(item.totalIn - item.totalOut) < 0 ? 'text-orange-500' : 'text-gray-900'}`}>
                                            {item.totalIn - item.totalOut > 0 ? `+${item.totalIn - item.totalOut}` : item.totalIn - item.totalOut}
                                        </span>
                                        <div className="flex items-center gap-3 text-gray-400">
                                            <span className="text-sm font-bold uppercase hidden lg:block">Ver Historial</span>
                                            {expandedId === item._id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                    </div>
                                </DataTableCell>
                            </DataTableRow>

                            {/* DETAILS SECTION - Increased font and spacing */}
                            {expandedId === item._id && (
                                <tr className="bg-gray-50/50">
                                    <td colSpan={4} className="p-8">
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                            <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">
                                                Log de Actividad Detallado
                                            </p>
                                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                                {details.map((log: any) => (
                                                    <div key={log._id} className="flex items-center justify-between bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                                                                log.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                            }`}>
                                                                {log.type === 'IN' ? <ArrowUpRight size={20}/> : <ArrowDownRight size={20}/>}
                                                            </div>
                                                            <div>
                                                                <p className="text-base font-black text-black">
                                                                    {log.amount} <span className="text-sm text-gray-500 font-medium">{item.unit || 'uds'}</span>
                                                                </p>
                                                                <p className="text-sm text-gray-400 font-bold">
                                                                    {log.user.name} • {new Date(log.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className="text-sm font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                                            {log.reason}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </DataTable>
            ) : (
                <div className="h-64 flex items-center justify-center bg-white rounded-3xl border border-dashed border-gray-200 text-lg text-gray-400 font-bold">
                    No se encontraron movimientos.
                </div>
            )}
        </div>
    );
}