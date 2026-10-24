import { NextResponse } from 'next/server';
import type { AnyBulkWriteOperation, ObjectId } from 'mongodb';
import { requirePermission } from '@/lib/authorize';
import { apiError, badRequest, getDb, isDuplicateKeyError, notFound, serverError, toObjectId } from '@/lib/api';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { MOVEMENT_REASONS, PERMISSIONS, STOCK_UNITS } from '@/lib/constants';
import { findOwnDepartment } from '@/lib/departments';
import { planLimitError } from '@/lib/plans';
import { createRateLimiter } from '@/lib/rate-limit';
import { afterStockChange } from '@/lib/stock-alerts';
import { generateUniqueSKU } from '@/lib/sku';
import {
    MAX_IMPORT_ROWS, validateImportRow,
    type ImportMode, type ImportResponse, type ImportRow, type ImportRowResult, type ImportRowStatus, type RawImportRow,
} from '@/lib/stock-import';
import type { StockItem } from '@/types/models';

type Params = { params: Promise<{ id: string }> };

/** Each preview and import reads the whole department: enough for a few tries a minute, not for a loop. */
const importLimiter = createRateLimiter({ max: 20, windowMs: 60_000 });

/** Updates sent to MongoDB at once. */
const UPDATE_CHUNK = 50;

/** What a valid row will do. */
type Planned =
    | { status: "create"; row: ImportRow; sku: string }
    | { status: "update"; row: ImportRow; item: StockItem; set: Partial<StockItem>; delta: number; result: ImportRowResult };

/**
 * POST /api/admin/departments/[id]/stock/import
 * Adds products to a department from the rows of a file (lib/stock-import.ts), if the plan allows them.
 * Body: { rows: RawImportRow[], mode: "skip" | "update", dryRun?: boolean }
 * - Rows whose SKU is new (or that have none: one is generated) create a product, with its quantity as an
 *   "Inventario inicial" movement. Rows whose SKU the department has are skipped, or with mode "update" change
 *   that product: the empty cells keep its values, and a new quantity is a movement for the difference.
 * - Invalid rows are left out and reported. With dryRun (the default) nothing is written: the dialog's preview.
 * Responds with ImportResponse, or the planLimit error when the new products don't fit in the plan.
 */
export async function POST(req: Request, { params }: Params) {
    const { session, error } = await requirePermission(PERMISSIONS.EDIT_STOCK);
    if (error) return error;

    try {
        const departmentId = toObjectId((await params).id);
        const department = departmentId && await findOwnDepartment(session, departmentId);
        if (!department) return notFound("departmentNotFound");

        const limitKey = session.user.id ?? session.user.email ?? "";
        if (importLimiter.isLimited(limitKey)) return apiError("tooManyAttempts", 429);
        importLimiter.hit(limitKey);

        const body = await req.json().catch(() => null);
        const rawRows: RawImportRow[] = Array.isArray(body?.rows) ? body.rows.filter((r: unknown) => !!r && typeof r === "object") : [];
        if (rawRows.length === 0) return badRequest("importEmpty");
        if (rawRows.length > MAX_IMPORT_ROWS) return apiError("importTooManyRows", 400, { max: MAX_IMPORT_ROWS });
        const mode: ImportMode = body.mode === "update" ? "update" : "skip";
        const dryRun = body.dryRun !== false;

        const db = await getDb();
        const stock = db.collection<StockItem>('department_stock');
        const existing = await stock.find({ departmentId: department._id, isDeleted: { $ne: true } }).toArray();
        const bySku = new Map(existing.map(item => [item.sku, item]));
        const byBarcode = new Map(existing.flatMap(item => item.barcode ? [[item.barcode, item] as const] : []));

        const validated = rawRows.map(validateImportRow);
        // SKUs in use or in the file: generated ones must not match any
        const taken = new Set([...bySku.keys(), ...validated.flatMap(v => v.row.sku ? [v.row.sku] : [])]);
        const seen = new Set<string>();
        const seenBarcodes = new Set<string>();
        const results: ImportRowResult[] = [];
        const planned: Planned[] = [];

        for (const { row, errors } of validated) {
            if (row.sku) {
                if (seen.has(row.sku)) errors.push("duplicateSku");
                seen.add(row.sku);
            }
            const item = row.sku ? bySku.get(row.sku) : undefined;
            if (row.barcode) {
                // Another product of the department already has it; else, an earlier row of the file does
                const owner = byBarcode.get(row.barcode);
                if (owner && (!item || !owner._id.equals(item._id))) errors.push("barcodeTaken");
                else if (seenBarcodes.has(row.barcode)) errors.push("duplicateBarcode");
                seenBarcodes.add(row.barcode);
            }
            const base = { line: row.line, name: row.name, sku: row.sku };
            if (errors.length > 0) {
                results.push({ ...base, status: "invalid", errors });
                continue;
            }

            if (!item) {
                const sku = row.sku ?? generateUniqueSKU(department.name, taken);
                planned.push({ status: "create", row, sku });
                results.push({ ...base, sku, generatedSku: !row.sku, status: "create", quantityBefore: 0, quantityAfter: row.quantity ?? 0 });
                continue;
            }
            if (mode === "skip") {
                results.push({ ...base, status: "skip", quantityBefore: item.quantity, quantityAfter: item.quantity });
                continue;
            }

            const set: Partial<StockItem> = {};
            if (row.name !== item.productName) set.productName = row.name;
            if (row.unit && row.unit !== item.unit) set.unit = row.unit;
            if (row.minStock !== null && row.minStock !== item.minStock) set.minStock = row.minStock;
            if (row.category && row.category !== item.category) set.category = row.category;
            if (row.barcode && row.barcode !== item.barcode) set.barcode = row.barcode;
            const delta = row.quantity === null ? 0 : row.quantity - item.quantity;
            const status: ImportRowStatus = Object.keys(set).length === 0 && delta === 0 ? "unchanged" : "update";
            const result: ImportRowResult = { ...base, status, quantityBefore: item.quantity, quantityAfter: item.quantity + delta };
            if (status === "update") planned.push({ status, row, item, set, delta, result });
            results.push(result);
        }

        const creates = planned.filter(p => p.status === "create");
        if (creates.length > 0) {
            const limitError = await planLimitError(department.clientId, "items", creates.length);
            if (limitError) return limitError;
        }

        if (!dryRun && planned.length > 0) {
            const now = new Date();
            const user = { id: toObjectId(session.user.id), name: session.user.name, email: session.user.email };
            const movementOf = (item: Pick<StockItem, "_id" | "productName" | "sku">, delta: number, previousBalance: number, reason: string) => ({
                inventoryId: item._id,
                departmentId: department._id,
                departmentName: department.name,
                clientId: department.clientId,
                productName: item.productName,
                sku: item.sku,
                type: delta > 0 ? "IN" : "OUT",
                amount: Math.abs(delta),
                previousBalance,
                newBalance: previousBalance + delta,
                reason,
                user,
                createdAt: now,
            });

            // 1. New products, then their starting quantity as a movement (reports work backwards from today's quantity)
            if (creates.length > 0) {
                const docs = creates.map(({ row, sku }) => ({
                    departmentId: department._id,
                    departmentName: department.name,
                    clientId: department.clientId,
                    productName: row.name,
                    sku,
                    unit: row.unit ?? STOCK_UNITS[0],
                    ...(row.category && { category: row.category }),
                    ...(row.barcode && { barcode: row.barcode }),
                    quantity: row.quantity ?? 0,
                    minStock: row.minStock ?? 0,
                    isDeleted: false,
                    createdAt: now,
                    updatedAt: now,
                }));
                let insertedIds: ObjectId[] = [];
                try {
                    const result = await db.collection('department_stock').insertMany(docs);
                    insertedIds = Object.values(result.insertedIds);
                    const movements = docs.flatMap((doc, i) => doc.quantity > 0
                        ? [movementOf({ ...doc, _id: insertedIds[i] }, doc.quantity, 0, MOVEMENT_REASONS.INITIAL_STOCK)]
                        : []);
                    if (movements.length > 0) await db.collection('stock_movements').insertMany(movements);
                } catch (error) {
                    // All or none: a product without its movement would break the reports
                    const partial = (error as { insertedIds?: Record<number, ObjectId> }).insertedIds;
                    const ids = insertedIds.length > 0 ? insertedIds : Object.values(partial ?? {});
                    if (ids.length > 0) {
                        await db.collection('department_stock').deleteMany({ _id: { $in: ids } });
                        await db.collection('stock_movements').deleteMany({ inventoryId: { $in: ids }, createdAt: now });
                    }
                    // Someone added one of these SKUs while the file was being imported
                    if (isDuplicateKeyError(error)) return apiError("importConflict", 409);
                    throw error;
                }
            }

            // 2. Changes to existing products. The quantity moves by the difference with what was read ($inc, like
            // /api/admin/inventory/[id]/move), so a runner's move in the meantime isn't lost and the history adds up
            const updates = planned.filter(p => p.status === "update");
            const movements: ReturnType<typeof movementOf>[] = [];
            const applied: { _id: ObjectId; delta: number }[] = [];
            for (let i = 0; i < updates.length; i += UPDATE_CHUNK) {
                await Promise.all(updates.slice(i, i + UPDATE_CHUNK).map(async ({ item, set, delta, result }) => {
                    const after = await stock.findOneAndUpdate(
                        { _id: item._id, isDeleted: { $ne: true } },
                        { $set: { ...set, updatedAt: now }, ...(delta !== 0 && { $inc: { quantity: delta } }) },
                        { returnDocument: "after" }
                    );
                    if (!after) {
                        // Deleted while importing
                        result.status = "skip";
                        return;
                    }
                    result.quantityAfter = after.quantity;
                    if (delta !== 0) {
                        applied.push({ _id: item._id, delta });
                        movements.push(movementOf(after, delta, after.quantity - delta, MOVEMENT_REASONS.IMPORT));
                    }
                }));
            }
            if (movements.length > 0) {
                try {
                    await db.collection('stock_movements').insertMany(movements);
                } catch (error) {
                    // Without their movements the changes would break the reports: undo the quantities
                    const undo: AnyBulkWriteOperation<StockItem>[] = applied.map(({ _id, delta }) => ({ updateOne: { filter: { _id }, update: { $inc: { quantity: -delta } } } }));
                    await stock.bulkWrite(undo);
                    throw error;
                }
            }
            // A new quantity can take a product to its minimum (or back above it), like a move
            await afterStockChange(req, applied.map(a => a._id));
        }

        const summary = { create: 0, update: 0, unchanged: 0, skip: 0, invalid: 0 } satisfies ImportResponse["summary"];
        for (const result of results) summary[result.status]++;

        if (!dryRun && (summary.create > 0 || summary.update > 0)) {
            await logAudit(AUDIT_ACTIONS.IMPORT_STOCK, {
                actor: session.user,
                clientId: department.clientId,
                details: { departmentId: department._id.toString(), departmentName: department.name, mode, ...summary },
            });
        }

        return NextResponse.json({ dryRun, summary, rows: results } satisfies ImportResponse);
    } catch (error) {
        console.error("Stock import error:", error);
        return serverError();
    }
}
