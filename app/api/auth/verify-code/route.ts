import { auth } from "@/auth";
import mongo from "@/lib/mongodb";
import { ROLES } from "@/lib/constants";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ message: "No autorizado" }, { status: 401 });

        const { code } = await req.json();

        const client = await mongo;
        const db = client.db(process.env.MONGODB_DB);

        // 1. Find the organization with this code
        const organization = await db.collection("clients").findOne({ clientCode: code });

        if (!organization) {
            return NextResponse.json({ message: "Código de organización no válido" }, { status: 404 });
        }

        // 2. Link the user to this organization as a 'user' (Runner)
        // Note: status is 'pending' until the Admin approves them in the dashboard
        await db.collection("users").updateOne(
            { email: session.user.email },
            {
                $set: {
                    clientId: organization._id,
                    clientName: organization.name,
                    role: ROLES.PENDING_USER, // this will trigger the "pendiente" status in the dashboard where Admins can approve them
                    isActive: true
                }
            }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ message: "Error al procesar el código" }, { status: 500 });
    }
}