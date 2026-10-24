import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { DataTable, DataTableCell, DataTableRow } from "@/components/ui/DataTable";
import { Badge, ExportLink, hrefWith, PageHeader, Pagination, SearchForm, Segmented } from "@/components/superadmin/ui";
import {
    INACTIVE_AFTER_DAYS, listOrganizations, ORGANIZATION_FILTERS, pageOf, requireSuperadmin,
    type OrganizationFilter, type OrganizationStatus,
} from "@/lib/superadmin";

const STATUS_TONE: Record<OrganizationStatus, "success" | "warning" | "neutral"> = { active: "success", inactive: "warning", closed: "neutral" };

/** Registry of every organization (read-only): search, filter by status, and open one for its details. */
export default async function SuperadminOrganizationsPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
    await requireSuperadmin();
    const params = await searchParams;
    const filter: OrganizationFilter = (ORGANIZATION_FILTERS as readonly string[]).includes(params.filter ?? "") ? params.filter as OrganizationFilter : "all";
    const page = pageOf(params.page);

    const [t, format, { rows, total, pages }] = await Promise.all([
        getTranslations("superadmin.organizations"), getFormatter(), listOrganizations({ q: params.q, filter, page }),
    ]);
    const tc = (key: string) => t(`columns.${key}`);
    const date = (value: Date | null) => value ? format.dateTime(value, { dateStyle: "medium" }) : "—";
    const href = (changes: Record<string, string | number | undefined>) =>
        hrefWith("/superadmin/organizations", { q: params.q, filter: filter === "all" ? undefined : filter, page, ...changes });

    return (
        <>
            <PageHeader title={t("title")} subtitle={t("subtitle")}>
                <ExportLink kind="organizations" params={{ q: params.q, filter: filter === "all" ? undefined : filter }} />
            </PageHeader>

            <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <SearchForm action="/superadmin/organizations" q={params.q} placeholder={t("searchPlaceholder")} keep={filter === "all" ? {} : { filter }} />
                <Segmented
                    label={tc("status")}
                    current={filter}
                    options={ORGANIZATION_FILTERS.map(value => ({ value, label: t(`filters.${value}`) }))}
                    hrefFor={value => href({ filter: value === "all" ? undefined : value, page: undefined })}
                />
            </div>
            <p className="mb-3 text-xs text-ink-subtle">{t("count", { count: total })}</p>

            {rows.length === 0 ? (
                <p className="rounded-3xl border border-line bg-card p-8 text-center text-sm text-ink-muted">{t("empty")}</p>
            ) : (
                <DataTable headers={["organization", "owner", "created", "members", "pending", "products", "lastActivity", "status"].map(key => ({ title: tc(key) }))}>
                    {rows.map(org => (
                        <DataTableRow key={org._id}>
                            <DataTableCell>
                                <Link href={`/superadmin/organizations/${org._id}`} className="font-semibold text-ink hover:text-accent">{org.name}</Link>
                                <p className="text-[11px] text-ink-subtle">{t("detail.products", { count: org.products })} · {org.departments} {tc("departments").toLowerCase()}</p>
                            </DataTableCell>
                            <DataTableCell className="text-ink-muted">{org.ownerEmail ?? "—"}</DataTableCell>
                            <DataTableCell className="whitespace-nowrap text-ink-muted">{date(org.createdAt)}</DataTableCell>
                            <DataTableCell className="tabular-nums">{format.number(org.members)}</DataTableCell>
                            <DataTableCell className="tabular-nums">{org.pending > 0 ? <Badge tone="warning">{format.number(org.pending)}</Badge> : "0"}</DataTableCell>
                            <DataTableCell className="tabular-nums">{format.number(org.products)}</DataTableCell>
                            <DataTableCell className="whitespace-nowrap text-ink-muted">{org.lastActivity ? format.relativeTime(org.lastActivity) : "—"}</DataTableCell>
                            <DataTableCell>
                                <span title={org.status === "inactive" ? t("inactiveHint", { days: INACTIVE_AFTER_DAYS }) : undefined}>
                                    <Badge tone={STATUS_TONE[org.status]}>{t(`status.${org.status}`)}</Badge>
                                </span>
                            </DataTableCell>
                        </DataTableRow>
                    ))}
                </DataTable>
            )}

            <Pagination page={page} pages={pages} hrefFor={p => href({ page: p })} />
        </>
    );
}
