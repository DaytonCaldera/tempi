import mongo from '@/lib/mongodb';
import { auth } from "@/auth";
import { NextResponse } from 'next/server';
import { ROLES } from '@/lib/constants';

export async function GET() {
    const session = await auth();
    if (session?.user?.role !== ROLES.SUPERADMIN) {
        return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }

    try {
        const client = await mongo;
        const db = client.db(process.env.MONGODB_DB);
        
        // Traemos solo el ID y el Nombre para el selector
        const clients = await db.collection('clients')
            .find({}, { projection: { name: 1 } })
            .toArray();

        return NextResponse.json(clients);
    } catch (error) {
        return NextResponse.json({ message: "Error al cargar clientes" }, { status: 500 });
    }
}