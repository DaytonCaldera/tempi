import { auth } from "@/auth";
import mongo from "@/lib/mongodb";
import { ROLES } from "@/lib/constants";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const defaultPlanName = "Plan Gratuito";

    try {
        const session = await auth();
        if (!session?.user?.email) return NextResponse.json({ message: "No autorizado" }, { status: 401 });

        const { companyName } = await req.json();
        if (!companyName) return NextResponse.json({ message: "Nombre de empresa requerido" }, { status: 400 });

        const client = await mongo;
        const db = client.db(process.env.MONGODB_DB);

        // 1. Generate a unique Client Code
        const clientCode = Math.random().toString(36).substring(2, 5).toUpperCase() + "-" +
                           Math.random().toString(36).substring(2, 5).toUpperCase();

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

        const clientId = newClient.insertedId;

        // 3. Create default "General" Department
        const defaultDepartment = await db.collection('departments').insertOne({
            name: "General",
            description: "Departamento inicial predeterminado",
            clientId: clientId,
            createdAt: new Date()
        });

        const departmentId = defaultDepartment.insertedId;

        // 4. MULTI-ORG UPDATE: Use $addToSet to add to the array, don't overwrite!
        await db.collection("users").updateOne(
            { email: session.user.email },
            {
                // We keep role/clientId at top-level for backwards compatibility 
                // but the "Source of Truth" is now the organizations array
                $set: {
                    isActive: true,
                },
                $addToSet: {
                    organizations: {
                        clientId: clientId,
                        clientCode: clientCode,
                        role: ROLES.ADMIN,
                        status: "active",
                        departments: [departmentId],
                        joinedAt: new Date()
                    }
                }
            }
        );

        return NextResponse.json({
            message: "Organización creada",
            clientCode,
            clientId: clientId.toString()
        });
    } catch (error) {
        console.error("Creation Error:", error);
        return NextResponse.json({ message: "Error al crear organización" }, { status: 500 });
    }
}