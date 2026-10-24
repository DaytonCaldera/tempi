import { STOCK_UNITS } from "@/lib/constants";
import { normalizeBarcode } from "@/lib/sku";

/**
 * Bulk import of a department's products from a CSV or Excel file. Shared by the import dialog (browser), which
 * reads the file and maps its columns, and POST /api/admin/departments/[id]/stock/import, which validates every
 * row again and writes them. Column titles and units are recognized in Spanish and English.
 */

/** Rows one import can have: bigger files are split by the admin. */
export const MAX_IMPORT_ROWS = 1000;

export const IMPORT_FIELDS = ["name", "sku", "barcode", "unit", "quantity", "minStock", "category"] as const;
export type ImportField = typeof IMPORT_FIELDS[number];

export type ImportCell = string | number | null;

/** A row as read from the file: its line in the file (1 = the first row) and the cells of the known columns. */
export type RawImportRow = { line: number } & Partial<Record<ImportField, ImportCell>>;

/** Why a row can't be imported. Labels are in the "stock.import.rowErrors" messages. */
export type ImportRowError =
    | "nameRequired" | "nameTooLong" | "skuTooLong" | "categoryTooLong"
    | "invalidUnit" | "invalidQuantity" | "invalidMinStock" | "duplicateSku"
    | "invalidBarcode" | "duplicateBarcode" | "barcodeTaken";

/** A valid row. null means the cell was empty: a new product gets the default, an existing one keeps its value. */
export type ImportRow = {
    line: number;
    name: string;
    sku: string | null;
    barcode: string | null;
    unit: StockUnit | null;
    quantity: number | null;
    minStock: number | null;
    category: string | null;
};

/** What to do with rows whose SKU is already in the department. */
export type ImportMode = "skip" | "update";

export type ImportRowStatus = "create" | "update" | "unchanged" | "skip" | "invalid";

export type ImportRowResult = {
    line: number;
    status: ImportRowStatus;
    name: string;
    sku: string | null;
    /** The SKU wasn't in the file: one is generated (a dry run shows an example) */
    generatedSku?: boolean;
    quantityBefore?: number;
    quantityAfter?: number;
    errors?: ImportRowError[];
};

export type ImportResponse = {
    dryRun: boolean;
    summary: Record<ImportRowStatus, number>;
    rows: ImportRowResult[];
};

type StockUnit = typeof STOCK_UNITS[number];

const MAX_NAME = 200;
const MAX_SKU = 50;
const MAX_CATEGORY = 100;
const MAX_AMOUNT = 1_000_000_000;

/** Lowercase, without accents, spaces or punctuation: "Stock mínimo" -> "stockminimo". */
const normalizeKey = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Column titles each field is recognized by, normalized. The template uses the first Spanish/English ones. */
const HEADER_ALIASES: Record<ImportField, string[]> = {
    name: ["nombre", "name", "producto", "product", "articulo", "item", "nombredelarticulo", "productname", "descripcion", "description"],
    sku: ["sku", "codigo", "code", "referencia", "reference", "ref"],
    barcode: ["codigodebarras", "codigobarras", "barcode", "barcodes", "ean", "ean13", "upc", "gtin", "codbarras"],
    unit: ["unidad", "unit", "unidaddemedida", "medida", "um", "uom"],
    quantity: ["cantidad", "quantity", "qty", "stock", "existencias", "stockinicial", "initialstock", "stockactual", "currentstock"],
    minStock: ["stockminimo", "minimumstock", "minstock", "minimo", "minimum", "min", "minimoalerta", "alerta"],
    category: ["categoria", "category", "familia", "grupo", "group"],
};

/** Ways a unit is written, normalized, for each stored unit. */
const UNIT_ALIASES: Record<StockUnit, string[]> = {
    unidades: ["unidades", "unidad", "und", "unds", "uds", "ud", "u", "units", "unit", "pcs", "pc", "piezas", "pieza", "pieces", "ea"],
    kg: ["kg", "kgs", "kilo", "kilos", "kilogramo", "kilogramos", "kilogram", "kilograms"],
    cajas: ["cajas", "caja", "cja", "cjs", "boxes", "box", "bx"],
    litros: ["litros", "litro", "l", "lt", "lts", "liters", "liter", "litres", "litre"],
};

/** The field each column of the header row is, or null for columns that aren't imported. */
export function mapHeaders(header: unknown[]): (ImportField | null)[] {
    const used = new Set<ImportField>();
    return header.map(cell => {
        const key = normalizeKey(String(cell ?? ""));
        const field = IMPORT_FIELDS.find(f => !used.has(f) && HEADER_ALIASES[f].includes(key)) ?? null;
        if (field) used.add(field);
        return field;
    });
}

/**
 * The rows of a sheet (an array of rows of cells, as CSV and Excel readers give it). The first non-empty row is
 * the header; empty rows are skipped. `hasNameColumn` is false when no column could be the product name.
 */
export function rowsFromSheet(sheet: unknown[][]): { rows: RawImportRow[]; hasNameColumn: boolean } {
    const isEmpty = (row: unknown[]) => row.every(cell => cell === null || cell === undefined || String(cell).trim() === "");
    const headerIndex = sheet.findIndex(row => !isEmpty(row));
    if (headerIndex === -1) return { rows: [], hasNameColumn: false };

    const fields = mapHeaders(sheet[headerIndex]);
    const rows: RawImportRow[] = [];
    sheet.slice(headerIndex + 1).forEach((cells, i) => {
        if (isEmpty(cells)) return;
        const row: RawImportRow = { line: headerIndex + i + 2 };
        fields.forEach((field, column) => {
            if (!field) return;
            const value = cells[column];
            row[field] = typeof value === "number" ? value : value === null || value === undefined ? null : String(value);
        });
        rows.push(row);
    });
    return { rows, hasNameColumn: fields.includes("name") };
}

const text = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value).trim() : "");

/**
 * A number of units: "12", "1.5", "1,5" or "1.234,5". The last "." or "," is the decimal separator.
 * null when empty, NaN when it isn't a number from 0 up.
 */
function parseAmount(value: unknown): number | null {
    if (typeof value === "number") return Number.isFinite(value) && value >= 0 && value <= MAX_AMOUNT ? value : NaN;
    let raw = text(value).replace(/\s/g, "");
    if (!raw) return null;
    const decimal = Math.max(raw.lastIndexOf("."), raw.lastIndexOf(","));
    if (decimal !== -1) raw = raw.slice(0, decimal).replace(/[.,]/g, "") + "." + raw.slice(decimal + 1);
    if (!/^\d+(\.\d+)?$/.test(raw)) return NaN;
    const amount = Number(raw);
    return amount <= MAX_AMOUNT ? amount : NaN;
}

/** The stored unit, null when empty, undefined when it isn't one of STOCK_UNITS. */
function parseUnit(value: unknown): StockUnit | null | undefined {
    const key = normalizeKey(text(value));
    if (!key) return null;
    return STOCK_UNITS.find(unit => UNIT_ALIASES[unit].includes(key));
}

/** Checks one row. Run by the server on every row it receives, whatever the browser checked. */
export function validateImportRow(raw: RawImportRow): { row: ImportRow; errors: ImportRowError[] } {
    const errors: ImportRowError[] = [];
    const name = text(raw.name);
    const sku = text(raw.sku);
    const category = text(raw.category);
    const barcode = normalizeBarcode(typeof raw.barcode === "number" ? String(raw.barcode) : raw.barcode);
    const unit = parseUnit(raw.unit);
    const quantity = parseAmount(raw.quantity);
    const minStock = parseAmount(raw.minStock);

    if (!name) errors.push("nameRequired");
    else if (name.length > MAX_NAME) errors.push("nameTooLong");
    if (sku.length > MAX_SKU) errors.push("skuTooLong");
    if (category.length > MAX_CATEGORY) errors.push("categoryTooLong");
    if (barcode === false) errors.push("invalidBarcode");
    if (unit === undefined) errors.push("invalidUnit");
    if (Number.isNaN(quantity)) errors.push("invalidQuantity");
    if (Number.isNaN(minStock)) errors.push("invalidMinStock");

    return {
        row: {
            line: Number(raw.line) || 0,
            name,
            sku: sku || null,
            barcode: barcode || null,
            unit: unit ?? null,
            quantity,
            minStock,
            category: category || null,
        },
        errors,
    };
}

/** Column titles of the template, in the order of IMPORT_FIELDS (the first aliases, as typed). */
export const TEMPLATE_HEADERS: Record<"es" | "en", Record<ImportField, string>> = {
    es: { name: "Nombre", sku: "SKU", barcode: "Código de barras", unit: "Unidad", quantity: "Cantidad", minStock: "Stock mínimo", category: "Categoría" },
    en: { name: "Name", sku: "SKU", barcode: "Barcode", unit: "Unit", quantity: "Quantity", minStock: "Minimum stock", category: "Category" },
};
