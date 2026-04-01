import { auth } from "@/auth";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import mongo from "@/lib/mongodb";


/**
 * PATCH handler - Updates inventory quantity with movement tracking and audit logging
 * 
 * @async
 * @param {Request} req - The incoming request object containing adjustment details
 * @param {Object} params - Route parameters
 * @param {Promise<{ id: string }>} params.id - Promise that resolves to the inventory item ID
 * @returns {Promise<NextResponse>}
 * - Success: `{ success: true, newQuantity: number, movementId: ObjectId }`
 * - Unauthorized: `{ error: "No autorizado" }` with status 401
 * - Not found: `{ error: "Producto no encontrado" }` with status 404
 * - Insufficient stock: `{ error: "Stock insuficiente" }` with status 400
 * - Server error: `{ error: "Error interno del servidor" }` with status 500
 * 
 * @requires Authentication session
 * @throws Will return 401 if user is not authenticated
 * 
 * @example
 * PATCH /api/admin/departments/[id]/stock
 * Body: { amount: number, type: "IN" | "OUT", reason?: string }
 * 
 * @description
 * - Validates user authentication
 * - Calculates new inventory balance
 * - Prevents negative stock levels
 * - Creates audit log in stock_movements collection
 * - Tracks user information for compliance
 */
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();

    // 1. Security Check
    if (!session) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    try {
        const { id } = await params; // This is the inventory item ID
        const { amount, type, reason } = await req.json(); // type: "IN" or "OUT"

        const client = await mongo;
        const db = client.db(process.env.MONGODB_DB);

        // 2. Fetch current state to calculate new balance
        const currentItem = await db.collection('department_stock').findOne({
            _id: new ObjectId(id)
        });

        if (!currentItem) {
            return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
        }

        // 3. Calculate Logic
        // If type is "OUT", we subtract. If "IN", we add.
        const adjustment = type === "IN" ? Math.abs(amount) : -Math.abs(amount);
        const newQuantity = (currentItem.quantity || 0) + adjustment;

        // Prevent negative stock if desired (Optional)
        if (newQuantity < 0) {
            return NextResponse.json({ error: "Stock insuficiente" }, { status: 400 });
        }

        // 4. Update the main Inventory document
        await db.collection('department_stock').updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    quantity: newQuantity,
                    updatedAt: new Date()
                }
            }
        );

        // 5. Create the Movement Log (This is what powers your Reports)
        const movementLog = {
            inventoryId: new ObjectId(id),
            departmentId: currentItem.departmentId, // Handy for filtering by dept later
            productName: currentItem.productName,
            sku: currentItem.sku,
            type: type, // "IN" or "OUT"
            amount: Math.abs(amount),
            previousBalance: currentItem.quantity,
            newBalance: newQuantity,
            reason: reason || "Ajuste manual",
            user: {
                name: session.user?.name || "Usuario Desconocido",
                email: session.user?.email
            },
            createdAt: new Date()
        };

        await db.collection('stock_movements').insertOne(movementLog);

        return NextResponse.json({
            success: true,
            newQuantity,
            movementId: movementLog.inventoryId
        });

    } catch (error) {
        console.error("PATCH Inventory Error:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}