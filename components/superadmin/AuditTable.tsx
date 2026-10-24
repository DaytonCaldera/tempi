import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { DataTable, DataTableCell, DataTableRow } from "@/components/ui/DataTable";
import { labelOf } from "@/i18n/labels";
import type { AuditRow } from "@/lib/superadmin";

type Change = { role?: string | null; status?: string | null; departments?: string[] };

/** Audit entries as a table. `showOrganization` is off on an organization's own page. */
export default async function AuditTable({ rows, showOrganization = true }: { rows: AuditRow[]; showOrganization?: boolean }) {
    const t = await getTranslations("superadmin.audit");
    const tRoles = await getTranslations("roles");
    const tCommon = await getTranslations("common");
    const format = await getFormatter();

    if (rows.length === 0) return <p className="text-sm text-ink-muted">{t("empty")}</p>;

    // "member.update" stores { before, after }: show only what changed. Support tools add a reason and an owner change
    const changes = (details: AuditRow["details"]) => {
        const extra: string[] = [];
        const owner = details?.owner as { before?: string | null; after?: string | null } | undefined;
        if (owner) extra.push(t("owner", { before: owner.before ?? "—", after: owner.after ?? "—" }));
        if (typeof details?.reason === "string") extra.push(t("reason", { reason: details.reason }));
        return [...memberChanges(details), ...extra];
    };
    const memberChanges = (details: AuditRow["details"]) => {
        const before = details?.before as Change | undefined;
        const after = details?.after as Change | undefined;
        if (!before || !after) return [];
        const show = (field: keyof Change, value: Change[keyof Change]) =>
            field === "departments" ? String((value as string[] | undefined)?.length ?? 0)
                : field === "role" ? labelOf(tRoles, String(value ?? "—"))
                    : labelOf(tCommon, String(value ?? "—"));
        return (["role", "status", "departments"] as const)
            .filter(field => JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null))
            .map(field => t("change", { field: t(`fields.${field}`), before: show(field, before[field]), after: show(field, after[field]) }));
    };

    // "organization.create" -> actions.create; unknown actions show as stored
    const actionLabel = (action: string) => {
        const key = `actions.${action.split(".").pop()}`;
        return t.has(key) ? t(key) : action;
    };

    const headers = ["when", "action", "actor", ...(showOrganization ? ["organization"] : []), "target"].map(key => ({ title: t(`columns.${key}`) }));

    return (
        <DataTable headers={headers}>
            {rows.map(row => (
                <DataTableRow key={row._id}>
                    <DataTableCell className="whitespace-nowrap text-ink-muted">
                        <time dateTime={row.createdAt.toISOString()} title={format.dateTime(row.createdAt, { dateStyle: "medium", timeStyle: "short" })}>
                            {format.relativeTime(row.createdAt)}
                        </time>
                    </DataTableCell>
                    <DataTableCell>
                        <p className="font-semibold">{actionLabel(row.action)}</p>
                        {changes(row.details).map(text => <p key={text} className="text-[11px] text-ink-subtle">{text}</p>)}
                    </DataTableCell>
                    <DataTableCell className="text-ink-muted">{row.actor.name || row.actor.email || "—"}{row.actor.name && row.actor.email && <span className="block text-[11px] text-ink-subtle">{row.actor.email}</span>}</DataTableCell>
                    {showOrganization && (
                        <DataTableCell>
                            {row.organization ? <Link href={`/superadmin/organizations/${row.organization._id}`} className="hover:text-accent">{row.organization.name || "—"}</Link> : "—"}
                        </DataTableCell>
                    )}
                    <DataTableCell className="text-ink-muted">
                        {row.target?.type === "user" && row.target.id
                            ? <Link href={`/superadmin/users/${row.target.id}`} className="hover:text-accent">{row.target.label || "—"}</Link>
                            : row.target?.label || "—"}
                    </DataTableCell>
                </DataTableRow>
            ))}
        </DataTable>
    );
}
