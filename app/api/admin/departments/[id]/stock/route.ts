/**
 * API route handler for managing department stock inventory
 * 
 * @module /api/admin/departments/[id]/stock
 * 
 * @description
 * Provides endpoints for creating, retrieving, and updating stock items for a specific department.
 * Includes movement tracking and audit logging for inventory changes.
 */

import { auth } from '@/auth';
import mongo from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';

/**
 * POST handler - Creates a new stock item for a department
 * 
 * @async
 * @param {Request} req - The incoming request object containing stock item data in JSON format
 * @param {Object} params - Route parameters
 * @param {string} params.id - The department ID
 * @returns {Promise<NextResponse>} 
 * - Success: `{ success: true, id: ObjectId }`
 * - Error: `{ error: string }` with status 500
 * 
 * @throws Will return 500 error if database operation fails
 * 
 * @example
 * POST /api/admin/departments/[id]/stock
 * Body: { name: string, sku: string, unit: string, quantity: number, minStock: number }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const client = await mongo;
        const db = client.db(process.env.MONGODB_DB);

        const departmentId = new ObjectId(await id);
        const newStockItem = {
            departmentId: departmentId,
            productName: body.name,
            sku: body.sku,
            unit: body.unit,
            quantity: Number(body.quantity),
            minStock: Number(body.minStock),
            updatedAt: new Date(),
            createdAt: new Date()
        };

        const result = await db.collection('department_stock').insertOne(newStockItem);

        return NextResponse.json({ success: true, id: result.insertedId });
    } catch (error) {
        return NextResponse.json({ error: "Error al guardar stock" }, { status: 500 });
    }
}

/**
 * GET handler - Retrieves all stock items for a specific department
 * 
 * @async
 * @param {Request} req - The incoming request object
 * @param {Object} params - Route parameters
 * @param {Promise<{ id: string }>} params.id - Promise that resolves to the department ID
 * @returns {Promise<Response>} Array of stock items with serialized ObjectIds
 * 
 * @example
 * GET /api/admin/departments/[id]/stock
 * Response: Array<{ _id: string, departmentId: string, productName: string, ... }>
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);

    const inventory = await db.collection('department_stock')
        .find({ departmentId: new ObjectId(id) })
        .toArray();

    return Response.json(inventory.map(item => ({
        ...item,
        _id: item._id.toString(),
        departmentId: item.departmentId.toString()
    })));
}


