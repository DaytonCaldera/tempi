import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { apiError, getDb, unauthorized } from '@/lib/api';
import { getTenantQuery } from '@/lib/tenant-guard';

/**
 * GET /api/admin/reports/sync?confirm=true
 * Finds stock items whose quantity doesn't match the sum of their movements and inserts
 * compensating movements so reports add up. Without ?confirm=true it only explains how to run it.
 */
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    // Safety check against running it by accident
    const { searchParams } = new URL(req.url);
    const confirm = searchParams.get('confirm');
    
    if (confirm !== 'true') {
        return NextResponse.json({ 
            message: "Ruta de sincronización lista. Añade '?confirm=true' a la URL para ejecutar las correcciones." 
        });
    }

    const db = await getDb();
    const tenantQuery = getTenantQuery(session);

    try {
        // 3. Ejecutamos el pipeline para encontrar las discrepancias (identico al de auditoría)
        const discrepancies = await db.collection('stock_movements').aggregate([
            { $match: tenantQuery },
            {
                $group: {
                    _id: "$inventoryId",
                    totalIn: { $sum: { $cond: [{ $eq: ["$type", "IN"] }, "$amount", 0] } },
                    totalOut: { $sum: { $cond: [{ $eq: ["$type", "OUT"] }, "$amount", 0] } }
                }
            },
            {
                $addFields: {
                    calculatedQuantity: { $subtract: ["$totalIn", "$totalOut"] }
                }
            },
            {
                $lookup: {
                    from: "department_stock",
                    localField: "_id",
                    foreignField: "_id",
                    as: "stock"
                }
            },
            { $unwind: "$stock" },
            {
                $addFields: {
                    actualQuantity: "$stock.quantity",
                    departmentId: "$stock.departmentId",
                    productName: "$stock.productName",
                    departmentName: "$stock.departmentName",
                    sku: "$stock.sku"
                }
            },
            {
                $addFields: {
                    difference: { $subtract: ["$actualQuantity", "$calculatedQuantity"] }
                }
            },
            {
                $match: {
                    difference: { $ne: 0 } // Solo artículos desincronizados
                }
            }
        ]).toArray();

        if (discrepancies.length === 0) {
            return NextResponse.json({ message: "La base de datos ya está 100% sincronizada. No se requiere acción." });
        }

        // 4. Construimos los movimientos compensatorios
        const compensatingMovements = discrepancies.map(item => {
            const isMissingIn = item.difference > 0;
            
            // Construimos el objeto de movimiento que inyectaremos
            return {
                ...tenantQuery,
                inventoryId: item._id,
                departmentId: item.departmentId,
                departmentName: item.departmentName,
                productName: item.productName,
                sku: item.sku,
                // Si la diferencia es positiva, faltaron INs. Si es negativa, faltaron OUTs.
                type: isMissingIn ? 'IN' : 'OUT', 
                amount: Math.abs(item.difference), // Siempre positivo
                reason: "Sincronización inicial del sistema",
                user: {
                    id: session.user.id,
                    name: session.user.name || "Sistema"
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };
        });

        // 5. Insertamos todos los registros faltantes de un solo golpe
        const result = await db.collection('stock_movements').insertMany(compensatingMovements);

        return NextResponse.json({
            success: true,
            message: `¡Sincronización exitosa! Se han corregido ${result.insertedCount} artículos.`,
            fixedItems: compensatingMovements.map(m => ({
                product: m.productName,
                adjustment: `${m.type} ${m.amount}`
            }))
        });

    } catch (error) {
        console.error("Error durante la sincronización de inventario:", error);
        return apiError("Fallo al ejecutar la sincronización masiva", 500);
    }
}