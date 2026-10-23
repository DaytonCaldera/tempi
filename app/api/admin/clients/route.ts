import { NextResponse } from 'next/server';
import { auth } from "@/auth";
import { getDb, serverError, unauthorized } from '@/lib/api';
import { ROLES } from '@/lib/constants';

/** GET /api/admin/clients - Id and name of every organization, for the superadmin's switcher. */
export async function GET() {
    const session = await auth();
    if (session?.user?.role !== ROLES.SUPERADMIN) return unauthorized();

    try {
        const db = await getDb();
        const clients = await db.collection('clients')
            .find({}, { projection: { name: 1 } })
            .toArray();

        return NextResponse.json(clients);
    } catch (error) {
        console.error("GET clients error:", error);
        return serverError();
    }
}
