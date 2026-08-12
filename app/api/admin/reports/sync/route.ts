import { auth } from '@/auth';
import mongo from '@/lib/mongodb';
import { getTenantQuery } from '@/lib/tenant-guard';
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const session = await auth();
    
    // 1. Verificación básica de sesión
    if (!session) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 2. Seguro contra ejecuciones accidentales
    const { searchParams } = new URL(req.url);
    const confirm = searchParams.get('confirm');
    
    if (confirm !== 'true') {
        return NextResponse.json({ 
            message: "Ruta de sincronización lista. Añade '?confirm=true' a la URL para ejecutar las correcciones." 
        });
    }

    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);
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
        return NextResponse.json({ error: "Fallo al ejecutar la sincronización masiva" }, { status: 500 });
    }
}