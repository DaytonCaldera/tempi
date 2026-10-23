import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { serverError, unauthorized } from '@/lib/api';
import { assignedStock } from '@/lib/departments';

/** GET /api/admin/inventory - Stock of the departments the user is assigned to in their active organization. */
export async function GET() {
    const session = await auth();
    if (!session?.user) return unauthorized();

    try {
        return NextResponse.json(await assignedStock(session));
    } catch (error) {
        console.error("GET inventory error:", error);
        return serverError();
    }
}
