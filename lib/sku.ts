/**
 * Product codes: SKUs and barcodes. Shared by the product form and the runner (browser) and the routes (server).
 * Each is unique among a department's products that aren't deleted (indexes in scripts/create-indexes.js).
 */

const MAX_BARCODE = 64;

/**
 * A barcode as stored: what the scanner or the person typed, without spaces (EAN/UPC digits, Code 128 text, a QR
 * with a short code). null when empty, false when it can't be one (too long, or characters scanners don't send).
 */
export function normalizeBarcode(value: unknown): string | null | false {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string" && typeof value !== "number") return false;
    const code = String(value).replace(/\s/g, "");
    if (!code) return null;
    return code.length <= MAX_BARCODE && /^[\x21-\x7E]+$/.test(code) ? code : false;
}

/** Random SKU with the department prefix, e.g. "LOG-4832". */
export const generateSKU = (departmentName: string, digits = 4) => {
    const prefix = departmentName.substring(0, 3).toUpperCase().replace(/\s/g, 'X');
    const min = 10 ** (digits - 1);
    const randomNum = Math.floor(min + Math.random() * 9 * min);
    return `${prefix}-${randomNum}`;
};

/** A generated SKU that isn't in `taken` (which it is added to). Uses a longer number once short ones keep colliding. */
export function generateUniqueSKU(departmentName: string, taken: Set<string>) {
    for (let attempt = 0; ; attempt++) {
        const sku = generateSKU(departmentName, attempt < 20 ? 4 : 6);
        if (!taken.has(sku)) {
            taken.add(sku);
            return sku;
        }
    }
}
