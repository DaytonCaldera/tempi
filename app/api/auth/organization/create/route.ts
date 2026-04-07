import { auth } from "@/auth";
import mongo from "@/lib/mongodb";
import { ROLES } from "@/lib/constants";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

export async function POST(req: Request) {

    const defaultPlanName = "Plan Gratuito";

    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ message: "No autorizado" }, { status: 401 });

        const { companyName } = await req.json();
        if (!companyName) return NextResponse.json({ message: "Nombre de empresa requerido" }, { status: 400 });

        const client = await mongo;
        const db = client.db(process.env.MONGODB_DB);

        // 1. Generate a unique Client Code (e.g., ABC-123)
        const clientCode = Math.random().toString(36).substring(2, 5).toUpperCase() + "-" +
            Math.random().toString(36).substring(2, 5).toUpperCase();

        //Find the plan in the db
        const defaultPlan = await db.collection("plans").findOne({ name: defaultPlanName });
        if (!defaultPlan) {
            return NextResponse.json({ message: "Plan predeterminado no encontrado" }, { status: 500 });
        }

        // 2. Create the Client Document
        const newClient = await db.collection("clients").insertOne({
            name: companyName,
            clientCode: clientCode,
            planId: defaultPlan._id,
            ownerEmail: session.user.email,
            createdAt: new Date(),
        });

        // 3. Update the User to be the ADMIN of this client
        await db.collection("users").updateOne(
            { email: session.user.email },
            {
                $set: {
                    role: ROLES.ADMIN,
                    clientId: newClient.insertedId,
                    clientCode: clientCode,
                    isActive: true
                }
            }
        );

        return NextResponse.json({
            message: "Organización creada",
            clientCode,
            role: ROLES.ADMIN
        });
    } catch (error) {
        return NextResponse.json({ message: "Error al crear organización" }, { status: 500 });
    }
}