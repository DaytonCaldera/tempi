import mongo from '@/lib/mongodb';
import { auth } from "@/auth";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { name, clientId, id } = await req.json();
        const client = await mongo;
        const db = client.db(process.env.MONGODB_DB);

        // Data object to save
        const deptData = {
            name,
            clientId: new ObjectId(clientId),
            updatedAt: new Date()
        };

        if (id) {
            await db.collection('departments').updateOne(
                { _id: new ObjectId(id) },
                { $set: deptData }
            );
            return NextResponse.json({ message: "Actualizado con éxito" });
        } else {
            await db.collection('departments').insertOne({
                ...deptData,
                createdAt: new Date()
            });
            return NextResponse.json({ message: "Creado con éxito" });
        }
    } catch (error) {
        return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 });
    }
}