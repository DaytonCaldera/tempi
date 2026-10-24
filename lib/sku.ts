/**
 * Product SKUs. Shared by the product form (browser) and the stock import (server).
 * A SKU is unique among a department's products that aren't deleted (index in scripts/create-indexes.js).
 */

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
