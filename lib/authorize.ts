import type { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { forbidden, unauthorized } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";

type Authorized = { session: Session; error?: undefined } | { session?: undefined; error: NextResponse };

/**
 * For API route handlers: the session of a signed-in user that has the permission in their active
 * organization, or the error response to return.
 * The session's role and permissions are re-read from the DB on every request (see the jwt callback in auth.ts).
 *
 * @example
 * const { session, error } = await requirePermission(PERMISSIONS.EDIT_STOCK);
 * if (error) return error;
 */
export async function requirePermission(permission: string): Promise<Authorized> {
    const session = await auth();
    if (!session?.user) return { error: await unauthorized() };
    if (!hasPermission(session, permission)) return { error: await forbidden() };
    return { session };
}
