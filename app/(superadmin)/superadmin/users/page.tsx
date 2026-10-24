import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { DataTable, DataTableCell, DataTableRow } from "@/components/ui/DataTable";
import { Badge, ExportLink, hrefWith, PageHeader, Pagination, SearchForm, Segmented } from "@/components/superadmin/ui";
import { labelOf } from "@/i18n/labels";
import { listUsers, pageOf, requireSuperadmin, USER_FILTERS, type UserFilter } from "@/lib/superadmin";

/** Registry of every user (read-only): search, filter, and open one for their details. */
export default async function SuperadminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
    await requireSuperadmin();
    const params = await searchParams;
    const filter: UserFilter = (USER_FILTERS as readonly string[]).includes(params.filter ?? "") ? params.filter as UserFilter : "all";
    const page = pageOf(params.page);

    const [t, tRoles, format, { rows, total, pages }] = await Promise.all([
        getTranslations("superadmin.users"), getTranslations("roles"), getFormatter(), listUsers({ q: params.q, filter, page }),
    ]);
    const href = (changes: Record<string, string | number | undefined>) =>
        hrefWith("/superadmin/users", { q: params.q, filter: filter === "all" ? undefined : filter, page, ...changes });

    return (
        <>
            <PageHeader title={t("title")} subtitle={t("subtitle")}>
                <ExportLink kind="users" params={{ q: params.q, filter: filter === "all" ? undefined : filter }} />
            </PageHeader>

            <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <SearchForm action="/superadmin/users" q={params.q} placeholder={t("searchPlaceholder")} keep={filter === "all" ? {} : { filter }} />
                <Segmented
                    label={t("columns.status")}
                    current={filter}
                    options={USER_FILTERS.map(value => ({ value, label: t(`filters.${value}`) }))}
                    hrefFor={value => href({ filter: value === "all" ? undefined : value, page: undefined })}
                />
            </div>
            <p className="mb-3 text-xs text-ink-subtle">{t("count", { count: total })}</p>

            {rows.length === 0 ? (
                <p className="rounded-3xl border border-line bg-card p-8 text-center text-sm text-ink-muted">{t("empty")}</p>
            ) : (
                <DataTable headers={["user", "organizations", "registered", "lastSeen", "status"].map(key => ({ title: t(`columns.${key}`) }))}>
                    {rows.map(user => (
                        <DataTableRow key={user._id}>
                            <DataTableCell>
                                <Link href={`/superadmin/users/${user._id}`} className="font-semibold text-ink hover:text-accent">{user.name || "—"}</Link>
                                <p className="text-[11px] text-ink-subtle">{user.email}</p>
                            </DataTableCell>
                            <DataTableCell>
                                {user.organizations.length === 0 ? <span className="text-ink-subtle">{t("noOrganization")}</span> : (
                                    <div className="flex max-w-sm flex-wrap gap-1.5">
                                        {user.organizations.map(org => (
                                            <Link key={org.clientId} href={`/superadmin/organizations/${org.clientId}`} className={`rounded-lg border border-line px-2 py-1 text-[11px] hover:border-line-strong ${org.status === "active" ? "text-ink" : "text-ink-subtle line-through"}`}>
                                                {org.name || "—"} · {labelOf(tRoles, org.role)}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </DataTableCell>
                            <DataTableCell className="whitespace-nowrap text-ink-muted">{format.dateTime(user.createdAt, { dateStyle: "medium" })}</DataTableCell>
                            <DataTableCell className="whitespace-nowrap text-ink-muted">{user.lastSeenAt ? format.relativeTime(user.lastSeenAt) : "—"}</DataTableCell>
                            <DataTableCell><Badge tone={user.isActive ? "success" : "danger"}>{t(user.isActive ? "status.active" : "status.disabled")}</Badge></DataTableCell>
                        </DataTableRow>
                    ))}
                </DataTable>
            )}

            <Pagination page={page} pages={pages} hrefFor={p => href({ page: p })} />
        </>
    );
}
