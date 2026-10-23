import { useFormatter, useTranslations } from "next-intl";
import type { ConsumptionReportDepartment } from "@/types/models";
import type { DateRange } from "./useConsumptionReport";

// Next.js layouts use fixed-height, scrolling containers; reset them so the browser prints every page
const PRINT_STYLES = `
    @media print {
        html, body {
            height: auto !important;
            overflow: visible !important;
        }
        body > div, main, section, article {
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            position: static !important;
        }
    }
`;

interface PrintableReportProps {
    title: string;
    range: DateRange;
    data: ConsumptionReportDepartment[];
    showDepartmentNames: boolean;
}

/** Plain-table version of the report, hidden on screen and shown only when printing. */
export function PrintableReport({ title, range, data, showDepartmentNames }: PrintableReportProps) {
    const t = useTranslations("reports");
    const format = useFormatter();
    const formatDate = (date: Date) => format.dateTime(date, { dateStyle: "medium", timeStyle: "short" });

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

            <div className="hidden print:block w-full text-black font-sans bg-white">
                <div className="mb-8 border-b-2 border-black pb-4">
                    <h1 className="text-3xl font-black uppercase tracking-tight">{title}</h1>
                    <p className="text-[1rem] font-bold mt-2 text-gray-700">
                        {t("printView.range", { start: formatDate(new Date(range.start)), end: formatDate(new Date(range.end)) })}
                    </p>
                    <p className="text-[1rem] mt-1 text-gray-600">
                        {t("printView.generated", { date: formatDate(new Date()) })}
                    </p>
                </div>

                {data.length === 0 && (
                    <p className="text-[1rem] font-bold text-center mt-10">{t("printView.empty")}</p>
                )}

                {data.map(department => (
                    <div key={`print-${department._id}`} className="mb-12">
                        {showDepartmentNames && (
                            <h2 className="text-xl font-black uppercase bg-gray-100 p-3 mb-4 rounded-md">
                                {t("printView.department", { name: department.departmentName })}
                            </h2>
                        )}

                        <table className="w-full text-left border-collapse text-[1rem]">
                            <thead>
                                <tr className="border-b-2 border-black text-sm uppercase tracking-wider">
                                    <th className="py-3 px-2 font-black">{t("columns.sku")}</th>
                                    <th className="py-3 px-2 font-black">{t("columns.product")}</th>
                                    <th className="py-3 px-2 font-black text-center">{t("columns.initial")}</th>
                                    <th className="py-3 px-2 font-black text-center">{t("columns.in")}</th>
                                    <th className="py-3 px-2 font-black text-center">{t("columns.out")}</th>
                                    <th className="py-3 px-2 font-black text-center">{t("columns.balance")}</th>
                                    <th className="py-3 px-2 font-black text-center">{t("columns.final")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {department.items.map(item => (
                                    <tr key={item.inventoryId} className="border-b border-gray-300 break-inside-avoid">
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
                ))}
            </div>
        </>
    );
}
