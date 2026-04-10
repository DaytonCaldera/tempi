import { auth } from "@/auth";
import mongo from "@/lib/mongodb";
import { getTenantQuery } from "@/lib/tenant-guard";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const session = await auth();

        // 1. Session & ClientId Validation
        if (!session?.user?.clientId) {
            return NextResponse.json({ message: "No autorizado o sin organización" }, { status: 401 });
        }

        const client = await mongo;
        const db = client.db(process.env.MONGODB_DB);
        const query = getTenantQuery(session);
        // 2. Filter by clientId
        const departments = await db.collection("departments")
            .find(query)
            .sort({ name: 1 })
            .toArray();

        return NextResponse.json(departments);
    } catch (error) {
        return NextResponse.json({ message: "Error al obtener departamentos" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.clientId) return NextResponse.json({ message: "No autorizado" }, { status: 401 });

        const { name, description } = await req.json();

        const client = await mongo;
        const db = client.db(process.env.MONGODB_DB);

        const cleanClientIdString = String(session?.user?.clientId);

        // 3. Anchor new data to the Client
        const newDept = {
            name,
            description,
            clientId: cleanClientIdString,
            createdAt: new Date(),
        };
        console.log(newDept);

        const result = await db.collection("departments").insertOne(newDept);
        return NextResponse.json({ ...newDept, _id: result.insertedId });
    } catch (error) {
        return NextResponse.json({ message: "Error al crear departamento" }, { status: 500 });
    }
}

//PATCH to update department
export async function PATCH(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.clientId) return NextResponse.json({ message: "No autorizado" }, { status: 401 });

        const { id, name, description } = await req.json();

        const client = await mongo;
        const db = client.db(process.env.MONGODB_DB);
        // 4. Ensure update is scoped to the Client
        const result = await db.collection("departments").updateOne(
            { _id: new ObjectId(id), clientId: session.user.clientId }, // Critical: Scope update
            { $set: { name, description } }
        );
        if (result.matchedCount === 0) {
            return NextResponse.json({ message: "Departamento no encontrado o sin permiso" }, { status: 404 });
        }
        return NextResponse.json({ message: "Departamento actualizado" });
    } catch (error) {
        return NextResponse.json({ message: "Error al actualizar departamento" }, { status: 500 });
    }
}