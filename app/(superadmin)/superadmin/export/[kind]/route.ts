import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { ROLES } from "@/lib/constants";
import { csvResponse } from "@/lib/csv";
import {
    listAudit, listOrganizations, listUsers, ORGANIZATION_FILTERS, USER_FILTERS,
    type OrganizationFilter, type UserFilter,
} from "@/lib/superadmin";

/** Most rows one export returns, so a single click can't pull an unbounded amount of data. */
const MAX_ROWS = 10_000;

/**
 * GET /superadmin/export/{organizations|users|audit}?q=&filter=&action= - The registry with the same filters
 * as its page, as a CSV file. Superadmin only (404 for anyone else), and every export is written to the audit log.
 */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
    const session = await auth();
    if (session?.user?.role !== ROLES.SUPERADMIN) return new NextResponse(null, { status: 404 });

    const { kind } = await params;
    const search = new URL(req.url).searchParams;
    const q = search.get("q") ?? undefined;
    const t = await getTranslations("superadmin");

    let header: string[];
    let rows: unknown[][];
    if (kind === "organizations") {
        const filter = (ORGANIZATION_FILTERS as readonly string[]).includes(search.get("filter") ?? "") ? search.get("filter") as OrganizationFilter : "all";
        const all = await collect(page => listOrganizations({ q, filter, page }));
        header = ["organization", "owner", "created", "members", "pending", "departments", "products", "lastActivity", "status"].map(key => t(`organizations.columns.${key}`));
        rows = all.map(o => [o.name, o.ownerEmail, o.createdAt, o.members, o.pending, o.departments, o.products, o.lastActivity, t(`organizations.status.${o.status}`)]);
    } else if (kind === "users") {
        const filter = (USER_FILTERS as readonly string[]).includes(search.get("filter") ?? "") ? search.get("filter") as UserFilter : "all";
        const all = await collect(page => listUsers({ q, filter, page }));
        header = [t("users.columns.user"), "Email", t("users.columns.organizations"), t("users.columns.registered"), t("users.columns.lastSeen"), t("users.columns.status")];
        rows = all.map(u => [
            u.name, u.email, u.organizations.map(o => `${o.name} (${o.role}${o.status === "active" ? "" : `, ${o.status}`})`).join("; "),
            u.createdAt, u.lastSeenAt, t(u.isActive ? "users.status.active" : "users.status.disabled"),
        ]);
    } else if (kind === "audit") {
        const action = search.get("action") || undefined;
        const all = await collect(page => listAudit({ q, action, page }));
        header = ["when", "action", "actor", "organization", "target"].map(key => t(`audit.columns.${key}`)).concat("Email", t("audit.details"));
        rows = all.map(e => [e.createdAt, e.action, e.actor.name, e.organization?.name, e.target?.label, e.actor.email, e.details ? JSON.stringify(e.details) : ""]);
    } else {
        return new NextResponse(null, { status: 404 });
    }

    await logAudit(AUDIT_ACTIONS.EXPORT_CSV, { actor: session.user, details: { kind, filters: Object.fromEntries(search), rows: rows.length } });
    return csvResponse(kind, header, rows);
}

/** Every page of a paginated list, up to MAX_ROWS rows. */
async function collect<T>(load: (page: number) => Promise<{ rows: T[]; pages: number }>): Promise<T[]> {
    const rows: T[] = [];
    for (let page = 1; rows.length < MAX_ROWS; page++) {
        const result = await load(page);
        rows.push(...result.rows);
        if (page >= result.pages) break;
    }
    return rows.slice(0, MAX_ROWS);
}
