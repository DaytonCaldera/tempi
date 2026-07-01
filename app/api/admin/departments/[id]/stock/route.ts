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


export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const client = await mongo;
        const db = client.db(process.env.MONGODB_DB);

        const departmentId = new ObjectId(await id);
        const departmentName = await db.collection("departments").findOne({ _id: departmentId }, { projection: { name: 1 } });
        if (!departmentName) {
            return NextResponse.json({ error: "Departamento no encontrado" }, { status: 404 });
        }

        const newStockItem = {
            departmentId: departmentId,
            departmentName: departmentName.name,
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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.clientId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);

    // ANCHOR: First, verify the department belongs to this client
    const department = await db.collection('departments').findOne({
        _id: new ObjectId(id),
        clientId: new ObjectId(session.user.clientId)
    });

    if (!department) return Response.json({ error: "Access denied" }, { status: 403 });

    const inventory = await db.collection('department_stock')
        .find({
            departmentId: new ObjectId(id),
            isDeleted: { $ne: true } // NEW: hide soft-deleted items from the list
        })
        .toArray();

    return Response.json(inventory.map(item => ({
        ...item,
        _id: item._id.toString(),
        departmentId: item.departmentId.toString()
    })));
}

