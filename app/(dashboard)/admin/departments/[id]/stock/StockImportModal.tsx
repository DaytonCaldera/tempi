"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download, FileSpreadsheet, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { usePlanLimitDialog } from "@/components/admin/PlanLimitDialog";
import {
    IMPORT_FIELDS, MAX_IMPORT_ROWS, TEMPLATE_HEADERS, rowsFromSheet,
    type ImportMode, type ImportResponse, type ImportRowStatus, type RawImportRow,
} from "@/lib/stock-import";

interface StockImportModalProps {
    isOpen: boolean;
    departmentId: string;
    onClose: () => void;
    /** Called after products were created or changed */
    onImported: () => void;
}

const STATUS_STYLES: Record<ImportRowStatus, string> = {
    create: "bg-accent/10 text-accent",
    update: "bg-warning/10 text-warning",
    unchanged: "bg-subtle text-ink-subtle",
    skip: "bg-subtle text-ink-subtle",
    invalid: "bg-danger/10 text-danger",
};

/** Text of a CSV file: UTF-8, or Windows-1252 (what Excel saves "CSV" as on Spanish Windows) when it isn't valid UTF-8. */
async function readText(file: File) {
    const buffer = await file.arrayBuffer();
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
        return new TextDecoder("windows-1252").decode(buffer);
    }
}

/** The cells of the file's first sheet. */
async function readSheetData(file: File): Promise<unknown[][]> {
    if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import("read-excel-file/browser");
        return readSheet(file);
    }
    const Papa = (await import("papaparse")).default;
    // The delimiter is detected: Excel uses ";" in Spanish and "," in English
    return Papa.parse<string[]>(await readText(file), { skipEmptyLines: false }).data;
}

/**
 * Bulk import from a CSV or Excel file: pick the file, review what each row will do (a dry run on the server),
 * then import. The file is read in the browser; the server validates every row again (lib/stock-import.ts).
 * The parent gives it a new `key` each time it opens, so it starts from the first step.
 */
export function StockImportModal({ isOpen, departmentId, onClose, onImported }: StockImportModalProps) {
    const t = useTranslations("stock.import");
    const tCommon = useTranslations("common");
    const tErrors = useTranslations("errors");
    const tUnits = useTranslations("units");
    const locale = useLocale() === "en" ? "en" : "es";
    const { handlePlanError, planDialog } = usePlanLimitDialog();

    const [fileName, setFileName] = useState<string | null>(null);
    const [rows, setRows] = useState<RawImportRow[] | null>(null);
    const [mode, setMode] = useState<ImportMode>("skip");
    const [preview, setPreview] = useState<ImportResponse | null>(null);
    const [done, setDone] = useState<ImportResponse | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const send = async (fileRows: RawImportRow[], importMode: ImportMode, dryRun: boolean) => {
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/departments/${departmentId}/stock/import`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rows: fileRows, mode: importMode, dryRun }),
            }).catch(() => null);
            const data = await res?.json().catch(() => null);
            if (!res?.ok) {
                if (!handlePlanError(data ?? {})) setError(data?.error || tErrors("connection"));
                return null;
            }
            return data as ImportResponse;
        } finally {
            setBusy(false);
        }
    };

    const handleFile = async (file: File | undefined) => {
        if (!file) return;
        setFileName(file.name);
        setRows(null);
        setPreview(null);
        setError(null);
        let sheet: unknown[][];
        try {
            sheet = await readSheetData(file);
        } catch (e) {
            console.error("Import file read error:", e);
            setError(t("errors.unreadable"));
            return;
        }
        const { rows: fileRows, hasNameColumn } = rowsFromSheet(sheet);
        if (!hasNameColumn) return setError(t("errors.missingNameColumn"));
        if (fileRows.length === 0) return setError(t("errors.empty"));
        if (fileRows.length > MAX_IMPORT_ROWS) return setError(t("errors.tooManyRows", { max: MAX_IMPORT_ROWS, count: fileRows.length }));
        setRows(fileRows);
        setPreview(await send(fileRows, mode, true));
    };

    const changeMode = async (value: ImportMode) => {
        setMode(value);
        if (rows) setPreview(await send(rows, value, true));
    };

    const confirm = async () => {
        if (!rows) return;
        const result = await send(rows, mode, false);
        if (!result) return;
        setDone(result);
        if (result.summary.create > 0 || result.summary.update > 0) onImported();
    };

    const downloadTemplate = async () => {
        const writeXlsxFile = (await import("write-excel-file/browser")).default;
        const headers = TEMPLATE_HEADERS[locale];
        await writeXlsxFile([
            IMPORT_FIELDS.map(field => headers[field]),
            [t("example.water"), null, tUnits("unidades"), 48, 12, t("example.drinks")],
            [t("example.rice"), null, tUnits("kg"), 25.5, 5, t("example.pantry")],
        ], { columns: [{ width: 30 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 16 }, { width: 18 }] })
            .toFile(t("templateFileName"));
    };

    const changes = preview ? preview.summary.create + preview.summary.update : 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t("title")} wide>
            {done ? (
                <div className="space-y-6 text-center">
                    <CheckCircle2 className="mx-auto text-accent" size={40} aria-hidden />
                    <p className="text-sm text-ink">{t("doneMessage", { created: done.summary.create, updated: done.summary.update })}</p>
                    {done.summary.invalid > 0 && <p className="text-sm text-danger">{t("doneInvalid", { count: done.summary.invalid })}</p>}
                    <button onClick={onClose} className="w-full rounded-2xl bg-inverse py-4 font-semibold text-on-inverse transition-all hover:bg-accent hover:text-on-accent">
                        {tCommon("close")}
                    </button>
                </div>
            ) : (
                <div className="space-y-5">
                    <p className="text-sm leading-relaxed text-ink-muted">{t("intro", { max: MAX_IMPORT_ROWS })}</p>

                    <div className="flex flex-col gap-3 sm:flex-row">
                        <label
                            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line px-4 py-6 text-sm font-semibold text-ink-muted transition-colors hover:border-accent hover:text-ink"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
                        >
                            {fileName ? <FileSpreadsheet size={18} aria-hidden /> : <Upload size={18} aria-hidden />}
                            <span className="truncate">{fileName ?? t("chooseFile")}</span>
                            <input
                                type="file"
                                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                className="sr-only"
                                onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }}
                            />
                        </label>
                        <button
                            type="button"
                            onClick={downloadTemplate}
                            className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-card px-4 py-3 text-xs font-bold uppercase text-ink-muted transition-all hover:bg-subtle"
                        >
                            <Download size={16} aria-hidden /> {t("downloadTemplate")}
                        </button>
                    </div>

                    <fieldset className="space-y-2">
                        <legend className="mb-1.5 ml-1 text-[10px] font-bold uppercase text-ink-subtle">{t("existingLabel")}</legend>
                        {(["skip", "update"] as const).map(value => (
                            <label key={value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-4 py-3 text-sm has-[:checked]:border-accent">
                                <input type="radio" name="import-mode" className="mt-1 accent-accent" checked={mode === value} disabled={busy} onChange={() => changeMode(value)} />
                                <span>
                                    <span className="block font-semibold text-ink">{t(`mode.${value}.title`)}</span>
                                    <span className="block text-xs text-ink-muted">{t(`mode.${value}.description`)}</span>
                                </span>
                            </label>
                        ))}
                    </fieldset>

                    {error && (
                        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
                        </p>
                    )}

                    {busy && !preview && <p className="text-sm text-ink-muted">{t("reading")}</p>}

                    {preview && (
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                                {(Object.keys(preview.summary) as ImportRowStatus[]).filter(status => preview.summary[status] > 0).map(status => (
                                    <span key={status} className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>
                                        {t(`summary.${status}`, { count: preview.summary[status] })}
                                    </span>
                                ))}
                            </div>
                            <div className="max-h-72 overflow-auto rounded-2xl border border-line">
                                <table className="w-full text-left text-xs">
                                    <thead className="sticky top-0 bg-subtle text-[10px] uppercase text-ink-subtle">
                                        <tr>
                                            <th className="px-3 py-2">{t("columns.line")}</th>
                                            <th className="px-3 py-2">{t("columns.product")}</th>
                                            <th className="px-3 py-2">{t("columns.quantity")}</th>
                                            <th className="px-3 py-2">{t("columns.result")}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line">
                                        {preview.rows.map((row, i) => (
                                            <tr key={i} className="align-top">
                                                <td className="px-3 py-2 font-mono text-ink-subtle">{row.line}</td>
                                                <td className="px-3 py-2">
                                                    <span className="block font-semibold text-ink">{row.name || "—"}</span>
                                                    <span className="font-mono text-ink-subtle">{row.generatedSku ? t("autoSku") : row.sku ?? ""}</span>
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-ink-muted">
                                                    {row.quantityAfter === undefined ? "—"
                                                        : row.status === "update" && row.quantityBefore !== row.quantityAfter ? `${row.quantityBefore} → ${row.quantityAfter}`
                                                        : row.quantityAfter}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLES[row.status]}`}>{t(`status.${row.status}`)}</span>
                                                    {row.errors?.map(code => <span key={code} className="mt-1 block text-danger">{t(`rowErrors.${code}`)}</span>)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {preview.summary.invalid > 0 && <p className="text-xs text-ink-muted">{t("invalidNote")}</p>}
                        </div>
                    )}

                    <button
                        onClick={confirm}
                        disabled={busy || changes === 0}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-inverse py-4 font-semibold text-on-inverse transition-all hover:bg-accent hover:text-on-accent disabled:opacity-50 disabled:hover:bg-inverse disabled:hover:text-on-inverse"
                    >
                        {busy && preview ? tCommon("saving") : t("confirm", { count: changes })}
                    </button>
                </div>
            )}
            {planDialog}
        </Modal>
    );
}
