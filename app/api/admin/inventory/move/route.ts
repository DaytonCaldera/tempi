import { auth } from '@/auth';
import { ROLES } from '@/lib/constants';
import mongo from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';

export async function PATCH(req: Request) {

    const allowedRoles = [ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.USER];

    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const { id, amount, type } = await req.json();

        if (!id || !amount || !type) {
            return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
        }

        const client = await mongo;
        const db = client.db(process.env.MONGODB_DB);

        // 1. Fetch current item to get metadata (Name, SKU, Dept)
        const currentItem = await db.collection('department_stock').findOne({ _id: new ObjectId(id) });
        if (!currentItem) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

        // 2. Security Check: Ensure runner belongs to this department
        const userDoc = await db.collection("users").findOne({ email: session.user.email });
        if (!userDoc?.role || !allowedRoles.includes(userDoc.role)) {
            return NextResponse.json(
                { error: "Tu cuenta aún no ha sido autorizada para realizar operaciones." },
                { status: 403 }
            );
        }

        // 2. Define the Permissions
        const isManagement = userDoc.role === ROLES.SUPERADMIN || userDoc.role === ROLES.ADMIN;
        const isFieldStaff = userDoc.role === ROLES.USER;

        const userDeptStrings = userDoc.departments?.map((id: any) => id.toString()) || [];
        const itemDeptString = currentItem.departmentId.toString();

        // 3. The Access Check
        // We check if the departmentId of the ITEM is inside the user's departmentIds ARRAY
        const hasAssignment = userDeptStrings.includes(itemDeptString);

        if (isManagement) {
            // Admins can move anything - carry on
        } else if (isFieldStaff && hasAssignment) {
            // Assigned Users can move their specific stock - carry on
        } else {
            console.log(isManagement, isFieldStaff, hasAssignment, session.user.role, currentItem.departmentId.toString(), userDoc.departments);

            // If they are a USER but NOT assigned to this dept, or have no role at all:
            return NextResponse.json(
                { error: "No tienes permiso para mover inventario en esta área." },
                { status: 403 }
            );
        }

        // 3. Calculate new quantity
        const quantityChange = type === 'IN' ? Math.abs(amount) : -Math.abs(amount);
        const newQuantity = Math.max(0, currentItem.quantity + quantityChange);

        // 4. ATOMIC UPDATE: Update stock and create movement log
        // We use a Promise.all or a transaction to ensure both happen
        const movementLog = {
            inventoryId: new ObjectId(id),
            departmentId: currentItem.departmentId,
            departmentName: currentItem.departmentName || "Sin Nombre", // We talked about saving this!
            productName: currentItem.productName,
            sku: currentItem.sku,
            type: type, // 'IN' or 'OUT'
            amount: Math.abs(amount),
            reason: type === 'OUT' ? "Consumo Runner" : "Reabastecimiento",
            user: {
                name: session.user.name,
                email: session.user.email,
                id: userDoc?._id
            },
            createdAt: new Date()
        };

        await Promise.all([
            // Update the main balance
            db.collection('department_stock').updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        quantity: newQuantity,
                        updatedAt: new Date()
                    }
                }
            ),
            // Create the audit trail
            db.collection('stock_movements').insertOne(movementLog)
        ]);

        return NextResponse.json({ success: true, newQuantity });

    } catch (error) {
        console.error("Move Error:", error);
        return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
    }
}