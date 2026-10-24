import { describe, expect, it } from "vitest";
import { generateUniqueSKU, normalizeBarcode } from "@/lib/sku";
import { IMPORT_FIELDS, mapHeaders, rowsFromSheet, TEMPLATE_HEADERS, validateImportRow } from "@/lib/stock-import";

describe("mapHeaders", () => {
    it("recognizes column titles in Spanish and English, in any order", () => {
        expect(mapHeaders(["Qty", "Producto", "Notas", "Stock mínimo", "UNIT", "Código de barras", "Costo"]))
            .toEqual(["quantity", "name", null, "minStock", "unit", "barcode", "unitCost"]);
    });

    it("recognizes the template's own titles", () => {
        for (const locale of ["es", "en"] as const) {
            expect(mapHeaders(IMPORT_FIELDS.map(field => TEMPLATE_HEADERS[locale][field]))).toEqual([...IMPORT_FIELDS]);
        }
    });

    it("uses each field once", () => {
        expect(mapHeaders(["Nombre", "Name"])).toEqual(["name", null]);
    });
});

describe("rowsFromSheet", () => {
    it("skips empty rows and numbers lines like the file", () => {
        const { rows, hasNameColumn } = rowsFromSheet([[], ["Nombre", "Cantidad"], ["Agua", "3"], [null, ""], ["Arroz", 2]]);
        expect(hasNameColumn).toBe(true);
        expect(rows).toEqual([{ line: 3, name: "Agua", quantity: "3" }, { line: 5, name: "Arroz", quantity: 2 }]);
    });

    it("notices when there is no name column", () => {
        expect(rowsFromSheet([["Cantidad"], [1]]).hasNameColumn).toBe(false);
    });
});

describe("validateImportRow", () => {
    it("accepts a full row", () => {
        const { row, errors } = validateImportRow({ line: 2, name: " Café ", sku: "C-1", barcode: 7501234567890, unit: "Kilos", quantity: "1.234,5", minStock: 3, unitCost: "₡1.500", category: "Despensa" });
        expect(errors).toEqual([]);
        expect(row).toEqual({ line: 2, name: "Café", sku: "C-1", barcode: "7501234567890", unit: "kg", quantity: 1234.5, minStock: 3, unitCost: 1500, category: "Despensa" });
    });

    it("leaves empty cells as null", () => {
        const { row, errors } = validateImportRow({ line: 2, name: "Agua" });
        expect(errors).toEqual([]);
        expect(row).toMatchObject({ sku: null, barcode: null, unit: null, quantity: null, minStock: null, unitCost: null, category: null });
    });

    it("reports every problem of a row", () => {
        const { errors } = validateImportRow({ line: 2, name: "", unit: "galones", quantity: "-2", minStock: "abc", barcode: "con espacio ñ", unitCost: "-1" });
        expect(errors.sort()).toEqual(["invalidBarcode", "invalidCost", "invalidMinStock", "invalidQuantity", "invalidUnit", "nameRequired"]);
    });
});

describe("codes", () => {
    it("normalizes barcodes", () => {
        expect(normalizeBarcode(" 750 123 ")).toBe("750123");
        expect(normalizeBarcode(7501234567890)).toBe("7501234567890");
        expect(normalizeBarcode("")).toBe(null);
        expect(normalizeBarcode("ñ")).toBe(false);
        expect(normalizeBarcode("x".repeat(65))).toBe(false);
    });

    it("generates SKUs that aren't taken", () => {
        const taken = new Set<string>();
        for (let i = 0; i < 9000; i++) generateUniqueSKU("Logística", taken);
        expect(taken.size).toBe(9000);
        expect([...taken].every(sku => /^LOG-\d{4}(\d{2})?$/.test(sku))).toBe(true);
    });
});
