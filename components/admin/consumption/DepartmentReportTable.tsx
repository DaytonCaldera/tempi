import { Fragment } from "react";
import { ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/DataTable";
import type { ConsumptionReportDepartment } from "@/types/models";
import { MovementDetails } from "./MovementDetails";
import type { MovementLog } from "./useConsumptionReport";

const HEADERS = [
    { title: "Producto" },
    { title: "Inv. Inicial (Rango)" },
    { title: "Entradas" },
    { title: "Salidas" },
    { title: "Balance" },
    { title: "Inv. Actual (Final)" }
];

interface DepartmentReportTableProps {
    department: ConsumptionReportDepartment;
    /** Show the department name above the table (global report) */
    showDepartmentName: boolean;
    expandedId: string | null;
    details: MovementLog[];
    onToggleDetails: (inventoryId: string) => void;
}

/** On-screen report table of one department; clicking a row shows its movements. */
export function DepartmentReportTable({ department, showDepartmentName, expandedId, details, onToggleDetails }: DepartmentReportTableProps) {
    return (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {showDepartmentName && (
                <div className="flex items-center gap-4 mb-6 px-4">
                    <div className="w-12 h-12 bg-brand text-brand-accent rounded-2xl flex items-center justify-center shadow-lg">
                        <MapPin size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-black leading-none uppercase tracking-tighter">{department.departmentName}</h2>
                        <p className="text-[10px] font-black text-brand/40 uppercase tracking-widest mt-1">Inventario por ubicación</p>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                <DataTable headers={HEADERS}>
                    {department.items.map(item => {
                        const isExpanded = expandedId === item.inventoryId;

                        return (
                            <Fragment key={item.inventoryId}>
                                <DataTableRow
                                    onClick={() => onToggleDetails(item.inventoryId)}
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
                                            <MovementDetails details={details} />
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        );
                    })}
                </DataTable>
            </div>
        </section>
    );
}
