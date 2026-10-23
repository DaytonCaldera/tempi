import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { apiError, badRequest, getDb, serverError, unauthorized } from "@/lib/api";
import { DEFAULT_PLAN_NAME, PLACEHOLDER_CLIENT_ID, ROLES } from "@/lib/constants";

/** Random join code in the format "ABC-123". */
const generateClientCode = () => {
    const part = () => Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${part()}-${part()}`;
};

/**
 * POST /api/auth/organization/create
 * Creates an organization on the free plan with a default "General" department,
 * and makes the current user its admin. Body: { companyName }
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.email) return unauthorized();

    try {
        const { companyName } = await req.json();
        if (!companyName) return badRequest("companyNameRequired");

        const db = await getDb();

        const defaultPlan = await db.collection("plans").findOne({ name: DEFAULT_PLAN_NAME });
        if (!defaultPlan) return apiError("defaultPlanNotFound", 500);

        const t = await getTranslations("api");
        const clientCode = generateClientCode();
        const { insertedId: clientId } = await db.collection("clients").insertOne({
            name: companyName,
            clientCode,
            planId: defaultPlan._id,
            ownerEmail: session.user.email,
            createdAt: new Date(),
        });

        const { insertedId: departmentId } = await db.collection('departments').insertOne({
            name: "General",
            description: t("defaultDepartmentDescription"),
            clientId,
            createdAt: new Date()
        });

        // Remove the old placeholder org, otherwise it is picked over this one on the next sign-in
        // (separate update: Mongo can't $pull and $addToSet the same array in one operation)
        await db.collection("users").updateOne(
            { email: session.user.email },
            { $pull: { organizations: { clientId: PLACEHOLDER_CLIENT_ID } } } as object
        );

        await db.collection("users").updateOne(
            { email: session.user.email },
            {
                $set: {
                    isActive: true,
                    activeOrganization: clientId, // Sign-in resolves the role from this org
                },
                $addToSet: {
                    organizations: {
                        clientId,
                        clientCode,
                        clientName: companyName,
                        role: ROLES.ADMIN,
                        status: "active",
                        departments: [departmentId],
                        joinedAt: new Date()
                    }
                }
            }
        );

        return NextResponse.json({ message: t("organizationCreated"), clientCode, clientId: clientId.toString() });
    } catch (error) {
        console.error("Create organization error:", error);
        return serverError();
    }
}
