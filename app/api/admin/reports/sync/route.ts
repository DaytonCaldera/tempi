import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { apiError, getDb, unauthorized } from '@/lib/api';
import { MOVEMENT_REASONS } from '@/lib/constants';
import { getTenantQuery } from '@/lib/tenant-guard';

/**
 * GET /api/admin/reports/sync?confirm=true
 * Finds stock items whose quantity doesn't match the sum of their movements and inserts
 * compensating movements so reports add up. Without ?confirm=true it only explains how to run it.
 */
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const t = await getTranslations('api.sync');

    // Safety check against running it by accident
    const { searchParams } = new URL(req.url);
    const confirm = searchParams.get('confirm');

    if (confirm !== 'true') {
        return NextResponse.json({ message: t('ready') });
    }

    const db = await getDb();
    const tenantQuery = getTenantQuery(session);

    try {
        // Items whose stored quantity doesn't match the sum of their movements
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
                    difference: { $ne: 0 } // Only items that are out of sync
                }
            }
        ]).toArray();

        if (discrepancies.length === 0) {
            return NextResponse.json({ message: t('alreadySynced') });
        }

        // One compensating movement per item
        const compensatingMovements = discrepancies.map(item => {
            const isMissingIn = item.difference > 0;

            return {
                ...tenantQuery,
                inventoryId: item._id,
                departmentId: item.departmentId,
                departmentName: item.departmentName,
                productName: item.productName,
                sku: item.sku,
                // A positive difference means INs are missing, a negative one means OUTs are missing
                type: isMissingIn ? 'IN' : 'OUT',
                amount: Math.abs(item.difference), // Always positive
                reason: MOVEMENT_REASONS.INITIAL_SYNC,
                user: {
                    id: session.user.id,
                    name: session.user.name ?? null
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };
        });

        // Insert every missing movement in one go
        const result = await db.collection('stock_movements').insertMany(compensatingMovements);

        return NextResponse.json({
            success: true,
            message: t('done', { count: result.insertedCount }),
            fixedItems: compensatingMovements.map(m => ({
                product: m.productName,
                adjustment: `${m.type} ${m.amount}`
            }))
        });

    } catch (error) {
        console.error("Inventory sync error:", error);
        return apiError("syncFailed", 500);
    }
}