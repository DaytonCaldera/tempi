import { auth } from '@/auth';
import mongo from '@/lib/mongodb';
import { getTenantQuery } from '@/lib/tenant-guard';
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const session = await auth();
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start'); 
    const end = searchParams.get('end');     
    const deptId = searchParams.get('deptId');

    if (!start || !end) {
        return NextResponse.json({ error: "Fechas requeridas" }, { status: 400 });
    }

    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);

    const tenantQuery = getTenantQuery(session);
    const deptMatch: any = { ...tenantQuery };
    
    if (deptId) {
        deptMatch._id = new ObjectId(deptId);
    }

    const departments = await db.collection('departments').find(deptMatch).toArray();
    const report = [];

    for (const dept of departments) {
        
        const stockMatch = { departmentId: dept._id };
        
        const items = await db.collection('department_stock').aggregate([
            { $match: stockMatch },
            {
                $lookup: {
                    from: "stock_movements",
                    let: { stockId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$inventoryId", "$$stockId"] }
                            }
                        },
                        {
                            $facet: {
                                // Movimientos estrictamente dentro de las fechas elegidas
                                inRange: [
                                    { $match: { createdAt: { $gte: new Date(start), $lte: new Date(end) } } },
                                    {
                                        $group: {
                                            _id: null,
                                            in: { $sum: { $cond: [{ $eq: ["$type", "IN"] }, "$amount", 0] } },
                                            out: { $sum: { $cond: [{ $eq: ["$type", "OUT"] }, "$amount", 0] } }
                                        }
                                    }
                                ],
                                // Movimientos que ocurrieron DESPUÉS de la fecha final (hasta el presente)
                                afterEnd: [
                                    { $match: { createdAt: { $gt: new Date(end) } } },
                                    {
                                        $group: {
                                            _id: null,
                                            in: { $sum: { $cond: [{ $eq: ["$type", "IN"] }, "$amount", 0] } },
                                            out: { $sum: { $cond: [{ $eq: ["$type", "OUT"] }, "$amount", 0] } }
                                        }
                                    }
                                ]
                            }
                        }
                    ],
                    as: "movements"
                }
            }
        ]).toArray();

        const processedItems = items.map(item => {
            const range = item.movements[0]?.inRange[0] || { in: 0, out: 0 };
            const after = item.movements[0]?.afterEnd[0] || { in: 0, out: 0 };

            // 1. La cantidad real que existe hoy en la base de datos
            const currentQuantity = item.quantity || 0;

            // 2. Todos los movimientos que ocurrieron DESDE la fecha de inicio hasta HOY
            const totalInAfterStart = range.in + after.in;
            const totalOutAfterStart = range.out + after.out;

            // 3. INGENIERÍA INVERSA: Descubrimos cuánto había exactamente al inicio del rango elegido
            const initialQuantity = currentQuantity - totalInAfterStart + totalOutAfterStart; 
            
            // 4. Los movimientos dentro del rango
            const totalIn = range.in;
            const totalOut = range.out;
            const finalBalance = totalIn - totalOut;
            
            // 5. El inventario al final de ese rango específico
            const finalQuantity = initialQuantity + finalBalance;

            return {
                inventoryId: item._id.toString(),
                productName: item.productName || "Sin Nombre",
                sku: item.sku || "N/A",
                initialQuantity,
                totalIn,
                totalOut,
                finalBalance,
                finalQuantity
            };
        });

        report.push({
            _id: dept._id,
            departmentName: dept.name,
            items: processedItems
        });
    }

    return NextResponse.json(report);
}