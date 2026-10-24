import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { PERMISSIONS } from "@/lib/constants";
import { badRequest, getDb, notFound, serverError, toObjectId, unauthorized } from "@/lib/api";
import { getTenantQuery } from "@/lib/tenant-guard";

/** GET /api/admin/departments - Departments of the user's organization, sorted by name. */
export async function GET() {
    const { session, error } = await requirePermission(PERMISSIONS.MANAGE_DEPTS);
    if (error) return error;

    try {
        const db = await getDb();
        const departments = await db.collection("departments")
            .find(getTenantQuery(session))
            .sort({ name: 1 })
            .toArray();

        return NextResponse.json(departments);
    } catch (error) {
        console.error("GET departments error:", error);
        return serverError();
    }
}

/** POST /api/admin/departments - Creates a department in the user's organization. Body: { name, description } */
export async function POST(req: Request) {
    const { session, error } = await requirePermission(PERMISSIONS.MANAGE_DEPTS);
    if (error) return error;

    try {
        const { name, description } = await req.json();
        if (!name) return badRequest("nameRequired");

        const db = await getDb();
        const clientId = toObjectId(session.user.clientId);
        if (!clientId) return unauthorized();

        const newDepartment = { name, description, clientId, createdAt: new Date() };
        const result = await db.collection("departments").insertOne(newDepartment);

        return NextResponse.json({ ...newDepartment, _id: result.insertedId });
    } catch (error) {
        console.error("POST department error:", error);
        return serverError();
    }
}

/** PATCH /api/admin/departments - Renames a department of the user's organization. Body: { id, name, description? } */
export async function PATCH(req: Request) {
    const { session, error } = await requirePermission(PERMISSIONS.MANAGE_DEPTS);
    if (error) return error;

    try {
        const { id, name, description } = await req.json();
        const departmentId = toObjectId(id);
        if (!departmentId) return badRequest();

        const db = await getDb();
        const result = await db.collection("departments").updateOne(
            { _id: departmentId, ...getTenantQuery(session) }, // Scoped to the organization
            // The form only sends the name: a missing description must not erase the stored one
            { $set: { name, ...(description !== undefined && { description }) } }
        );
        if (result.matchedCount === 0) return notFound("departmentNotFoundOrDenied");

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("PATCH department error:", error);
        return serverError();
    }
}
