import { auth } from "@/auth";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import mongo from "@/lib/mongodb";

/**
 * PUT handler - Updates a stock item's descriptive details (name, SKU, unit, minStock)
 *
 * @async
 * @param {Request} req - The incoming request object containing updated fields
 * @param {Object} params - Route parameters
 * @param {Promise<{ id: string, stockId: string }>} params - Department ID (id) and inventory item ID (stockId)
 * @returns {Promise<NextResponse>}
 * - Success: `{ success: true, item: object }`
 * - Unauthorized: `{ error: "No autorizado" }` with status 401
 * - Not found / access denied: `{ error: "Producto no encontrado o acceso denegado" }` with status 404
 * - Duplicate SKU: `{ error: "Ya existe un producto con ese SKU en este departamento" }` with status 409
 * - Validation error: `{ error: "Nombre y SKU son obligatorios" }` with status 400
 * - Server error: `{ error: "Error interno del servidor" }` with status 500
 *
 * @requires Authentication session
 *
 * @description
 * - Does NOT modify quantity. Quantity changes must go through the /move (PATCH) route
 *   so they stay tracked in stock_movements for audit purposes.
 * - Validates user authentication and department ownership via clientId (multi-tenancy).
 * - Prevents duplicate SKUs within the same department.
 */
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string; stockId: string }> }
) {
    const session = await auth();

    // 1. Security Check
    if (!session) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    try {
        const { id: departmentId, stockId } = await params;
        const { name, sku, unit, minStock } = await req.json();

        if (!name || !sku) {
            return NextResponse.json({ error: "Nombre y SKU son obligatorios" }, { status: 400 });
        }

        const client = await mongo;
        const db = client.db(process.env.MONGODB_DB);

        const currentItem = await db.collection('department_stock').findOne({
            _id: new ObjectId(stockId),
            departmentId: new ObjectId(departmentId)
        });

        // ANCHOR: Verify item ownership via department (multi-tenancy)
        const dept = await db.collection('departments').findOne({
            _id: new ObjectId(departmentId),
            clientId: new ObjectId(session.user.clientId)
        });

        if (!currentItem || !dept) {
            return NextResponse.json({ error: "Producto no encontrado o acceso denegado" }, { status: 404 });
        }

        // Prevent duplicate SKU within the same department (excluding this item itself)
        const duplicate = await db.collection('department_stock').findOne({
            _id: { $ne: new ObjectId(stockId) },
            departmentId: new ObjectId(departmentId),
            sku: sku
        });

        if (duplicate) {
            return NextResponse.json({ error: "Ya existe un producto con ese SKU en este departamento" }, { status: 409 });
        }

        // Update only descriptive fields — quantity is intentionally excluded
        await db.collection('department_stock').updateOne(
            { _id: new ObjectId(stockId) },
            {
                $set: {
                    productName: name,
                    sku: sku,
                    unit: unit,
                    minStock: minStock,
                    updatedAt: new Date()
                }
            }
        );

        const updatedItem = await db.collection('department_stock').findOne({
            _id: new ObjectId(stockId)
        });

        return NextResponse.json({ success: true, item: updatedItem });

    } catch (error) {
        console.error("PUT Inventory Error:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}