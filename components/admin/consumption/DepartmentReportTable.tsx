import { Fragment } from "react";
import { ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/DataTable";
import type { ConsumptionReportDepartment } from "@/types/models";
import { MovementDetails } from "./MovementDetails";
import type { MovementLog } from "./useConsumptionReport";

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
    const t = useTranslations("reports");
    const headers = [
        { title: t("columns.product") },
        { title: t("columns.initialRange") },
        { title: t("columns.in") },
        { title: t("columns.out") },
        { title: t("columns.transfers") },
        { title: t("columns.balance") },
        { title: t("columns.currentFinal") }
    ];

    return (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {showDepartmentName && (
                <div className="flex items-center gap-4 mb-6 px-4">
                    <div className="w-12 h-12 bg-accent/10 text-accent rounded-2xl flex items-center justify-center">
                        <MapPin size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-semibold text-ink leading-none tracking-tight">{department.departmentName}</h2>
                        <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mt-1">{t("locationInventory")}</p>
                    </div>
                </div>
            )}

            <div>
                <DataTable headers={headers}>
                    {department.items.map(item => {
                        const isExpanded = expandedId === item.inventoryId;

                        return (
                            <Fragment key={item.inventoryId}>
                                <DataTableRow
                                    onClick={() => onToggleDetails(item.inventoryId)}
                                    className={`cursor-pointer transition-colors ${isExpanded ? "bg-subtle" : "hover:bg-subtle/60"}`}
                                >
                                    <DataTableCell>
                                        <div className="flex flex-col">
                                            <span className="text-lg font-semibold text-ink tracking-tight">{item.productName}</span>
                                            <span className="text-[11px] font-semibold text-ink-muted bg-card border border-line w-fit px-2 py-0.5 rounded-md mt-1 tracking-wider uppercase">{item.sku}</span>
                                        </div>
                                    </DataTableCell>

                                    <DataTableCell>
                                        <span className="text-base font-bold text-ink-muted">{item.initialQuantity}</span>
                                    </DataTableCell>

                                    <DataTableCell>
                                        <span className="px-3 py-1 bg-success/10 text-success text-base font-semibold rounded-lg">+{item.totalIn}</span>
                                    </DataTableCell>

                                    <DataTableCell>
                                        <span className="px-3 py-1 bg-danger/10 text-danger text-base font-semibold rounded-lg">-{item.totalOut}</span>
                                    </DataTableCell>

                                    {/* Stock moved from/to other departments: not consumption, but part of the balance */}
                                    <DataTableCell>
                                        <span className="text-sm font-semibold text-ink-muted tabular-nums whitespace-nowrap">
                                            {item.transferIn || item.transferOut ? `+${item.transferIn} / −${item.transferOut}` : "—"}
                                        </span>
                                    </DataTableCell>

                                    <DataTableCell>
                                        <span className={`text-lg font-semibold ${item.finalBalance < 0 ? 'text-danger' : 'text-ink'}`}>
                                            {item.finalBalance > 0 ? `+${item.finalBalance}` : item.finalBalance}
                                        </span>
                                    </DataTableCell>

                                    <DataTableCell>
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-xl font-semibold text-accent bg-inverse px-3 py-1 rounded-lg">
                                                {item.finalQuantity}
                                            </span>
                                            <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-inverse text-on-inverse' : 'text-ink-subtle'}`}>
                                                {isExpanded ? <ChevronUp size={20} strokeWidth={3} /> : <ChevronDown size={20} strokeWidth={3} />}
                                            </div>
                                        </div>
                                    </DataTableCell>
                                </DataTableRow>

                                {isExpanded && (
                                    <tr>
                                        <td colSpan={6} className="p-8 bg-subtle/60">
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
