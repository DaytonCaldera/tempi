import { getFormatter, getTranslations } from "next-intl/server";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import writeXlsxFile from "write-excel-file/node";
import { csvResponse, downloadResponse } from "@/lib/csv";
import type { ConsumptionReportDepartment, ConsumptionReportItem } from "@/types/models";

/**
 * Server only: the consumption report as a file (app/api/admin/reports/export/route.ts), in every plan.
 * CSV and Excel hold one row per product with the raw numbers; the PDF is the report laid out to read or print.
 */

export const REPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export type ReportFormat = typeof REPORT_FORMATS[number];

export interface ReportFile {
    report: ConsumptionReportDepartment[];
    /** The range the report covers (its start already cut to the plan's history) */
    start: Date;
    end: Date;
    /** Whether the report was asked for one department */
    singleDepartment: boolean;
    currency: string;
}

const FILE_NAME = "consumo";

/** The consumed value, or empty when it can't be known (some outs have no cost and none was valued) */
const consumedValueOf = (item: ConsumptionReportItem) =>
    item.consumedValueIncomplete && !item.consumedValue ? null : item.consumedValue;

/** The report in `format`, as a download. */
export async function reportFileResponse(format: ReportFormat, file: ReportFile) {
    if (format === "pdf") return downloadResponse(FILE_NAME, "pdf", "application/pdf", await reportPdf(file));

    const t = await getTranslations("reports");
    const header = ["department", "sku", "product", "initial", "in", "out", "transferIn", "transferOut", "balance", "final", "unitCost", "consumedValue"].map(key => t(`columns.${key}`));
    const rows = file.report.flatMap(department => department.items.map(item => [
        department.departmentName, item.sku, item.productName, item.initialQuantity, item.totalIn, item.totalOut, item.transferIn, item.transferOut, item.finalBalance, item.finalQuantity,
        item.unitCost, consumedValueOf(item),
    ]));

    if (format === "csv") return csvResponse(FILE_NAME, header, rows.map(row => row.map(value => value ?? "")));

    const MONEY = "#,##0.00";
    const buffer = await writeXlsxFile([
        header.map(value => ({ value, fontWeight: "bold" as const })),
        ...rows.map(row => row.map((value, column) =>
            value === null ? null : { value, ...(column >= 10 && { format: MONEY }) })),
    ], {
        columns: [{ width: 22 }, { width: 14 }, { width: 32 }, ...Array(9).fill({ width: 14 })],
        stickyRowsCount: 1,
    }).toBuffer();
    return downloadResponse(FILE_NAME, "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", new Uint8Array(buffer));
}

// Characters of WinAnsi (the encoding of the PDF's built-in Helvetica) beyond Latin-1
const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const encodable = (char: string) => {
    const code = char.charCodeAt(0);
    return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.includes(char);
};

/**
 * Text the built-in font can draw: the narrow spaces and minus signs Intl uses become plain ones, and anything
 * else outside WinAnsi (emoji, other scripts in a product name) becomes "?" instead of garbage.
 */
function pdfText(text: string) {
    return Array.from(text.replace(/[  ]/g, " ").replace(/−/g, "-"), char => (encodable(char) ? char : "?")).join("");
}

async function reportPdf({ report, start, end, singleDepartment, currency }: ReportFile): Promise<Uint8Array<ArrayBuffer>> {
    const t = await getTranslations("reports");
    const format = await getFormatter();
    const formatDate = (date: Date) => pdfText(format.dateTime(date, { dateStyle: "medium", timeStyle: "short" }));
    // Some symbols (₡, ₲) aren't in the built-in font: those currencies are written with their code
    const symbolMoney = (value: number) => format.number(value, { style: "currency", currency, currencyDisplay: "narrowSymbol" });
    const useSymbol = Array.from(symbolMoney(1).replace(/[  −]/g, "")).every(encodable);
    const money = (value: number) => pdfText(useSymbol ? symbolMoney(value) : format.number(value, { style: "currency", currency, currencyDisplay: "code" }));
    const totalOf = (items: ConsumptionReportItem[]) => items.reduce((sum, item) => sum + item.consumedValue, 0);

    const title = singleDepartment && report.length === 1
        ? t("departmentTitle", { name: report[0].departmentName })
        : t("generalTitle");

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setProperties({ title: pdfText(title), creator: "Vitalliz" });

    doc.setFont("helvetica", "bold").setFontSize(18).text(pdfText(title), margin, margin + 10);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(80);
    doc.text(pdfText(t("pdf.range", { start: formatDate(start), end: formatDate(end) })), margin, margin + 30);
    doc.text(pdfText(t("pdf.generated", { date: formatDate(new Date()) })), margin, margin + 44);
    doc.setDrawColor(0).setLineWidth(1).line(margin, margin + 54, pageWidth - margin, margin + 54);
    let y = margin + 74;

    if (report.length === 0) {
        doc.setTextColor(0).setFontSize(12).text(pdfText(t("pdf.empty")), margin, y);
    }

    const head = [["sku", "product", "initial", "in", "out", "transfers", "consumedValue", "balance", "final"].map(key => pdfText(t(`columns.${key}`)))];
    const numberColumn = { halign: "right" as const };
    for (const department of report) {
        // Keep the department name with its table: start a new page when there's no room for a few rows
        if (y > pageHeight - 120) {
            doc.addPage();
            y = margin;
        }
        if (!singleDepartment) {
            doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(0);
            doc.text(pdfText(t("pdf.department", { name: department.departmentName })), margin, y);
            y += 10;
        }

        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin, bottom: margin + 10 },
            head,
            body: department.items.map(item => [
                pdfText(item.sku),
                pdfText(item.productName),
                format.number(item.initialQuantity),
                `+${format.number(item.totalIn)}`,
                `-${format.number(item.totalOut)}`,
                item.transferIn || item.transferOut ? `+${format.number(item.transferIn)} / -${format.number(item.transferOut)}` : "-",
                consumedValueOf(item) === null ? "-" : money(item.consumedValue),
                item.finalBalance > 0 ? `+${format.number(item.finalBalance)}` : format.number(item.finalBalance),
                format.number(item.finalQuantity),
            ].map(pdfText)),
            foot: [[{ content: pdfText(t.markup("departmentConsumedValue", { value: money(totalOf(department.items)), b: chunks => chunks })), colSpan: 9, styles: { halign: "right" } }]],
            showFoot: "lastPage",
            theme: "grid",
            styles: { font: "helvetica", fontSize: 9, cellPadding: 5, textColor: 20, lineColor: 200, lineWidth: 0.5 },
            headStyles: { fillColor: 30, textColor: 255, fontStyle: "bold" },
            footStyles: { fillColor: 245, textColor: 0, fontStyle: "bold" },
            alternateRowStyles: { fillColor: 250 },
            columnStyles: {
                0: { cellWidth: 80, textColor: 90 },
                2: numberColumn, 3: { ...numberColumn, textColor: [21, 128, 61] }, 4: { ...numberColumn, textColor: [185, 28, 28] },
                5: numberColumn, 6: numberColumn, 7: { ...numberColumn, fontStyle: "bold" }, 8: { ...numberColumn, fontStyle: "bold" },
            },
        });
        // autoTable leaves where the table ended on the document
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 28;
    }

    if (report.length > 1) {
        if (y > pageHeight - margin - 20) {
            doc.addPage();
            y = margin;
        }
        doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(0);
        doc.text(pdfText(t.markup("totalConsumedValue", { value: money(report.reduce((sum, d) => sum + totalOf(d.items), 0)), b: chunks => chunks })), pageWidth - margin, y, { align: "right" });
    }

    // Page numbers, now that the page count is known
    const pages = doc.getNumberOfPages();
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(120);
    for (let page = 1; page <= pages; page++) {
        doc.setPage(page);
        doc.text("Vitalliz", margin, pageHeight - 20);
        doc.text(pdfText(t("pdf.page", { page, pages })), pageWidth - margin, pageHeight - 20, { align: "right" });
    }

    return new Uint8Array(doc.output("arraybuffer"));
}
