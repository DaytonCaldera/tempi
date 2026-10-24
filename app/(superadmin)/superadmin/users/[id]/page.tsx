import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import AccessDiagnosis from "@/components/superadmin/AccessDiagnosis";
import AuditTable from "@/components/superadmin/AuditTable";
import { Badge, PageHeader } from "@/components/superadmin/ui";
import { DataTable, DataTableCell, DataTableRow } from "@/components/ui/DataTable";
import { labelOf } from "@/i18n/labels";
import { getUserDetail, requireSuperadmin } from "@/lib/superadmin";
import { getAccessDiagnosis } from "@/lib/superadmin-insights";

/** One user, read-only: how they get into the app, their organizations, recent activity and history. */
export default async function SuperadminUserPage({ params }: { params: Promise<{ id: string }> }) {
    await requireSuperadmin();
    const { id } = await params;
    const [detail, diagnosis] = await Promise.all([getUserDetail(id), getAccessDiagnosis(id)]);
    if (!detail) notFound();

    const [t, tRoles, tCommon, format] = await Promise.all([
        getTranslations("superadmin.users"), getTranslations("roles"), getTranslations("common"), getFormatter(),
    ]);
    const { user, memberships, movements30d, audit } = detail;
    const when = (value: Date | null) => value ? format.relativeTime(value) : "—";

    const facts = [
        { label: t("detail.registered"), value: format.dateTime(user.createdAt, { dateStyle: "medium" }) },
        { label: t("detail.lastLogin"), value: when(user.lastLoginAt) },
        { label: t("detail.lastSeen"), value: when(user.lastSeenAt) },
        { label: t("detail.movements"), value: format.number(movements30d) },
    ];

    return (
        <>
            <Link href="/superadmin/users" className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-ink-subtle hover:text-ink">
                <ArrowLeft size={14} aria-hidden /> {t("detail.back")}
            </Link>
            <PageHeader title={user.name || user.email} subtitle={user.email}>
                <Badge tone={user.isActive ? "success" : "danger"}>{t(user.isActive ? "status.active" : "status.disabled")}</Badge>
            </PageHeader>

            <dl className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {facts.map(fact => (
                    <div key={fact.label} className="rounded-2xl border border-line bg-card p-4">
                        <dt className="text-xs text-ink-subtle">{fact.label}</dt>
                        <dd className="mt-1 text-sm font-semibold text-ink">{fact.value}</dd>
                    </div>
                ))}
            </dl>

            {diagnosis && <div id="diagnosis" className="mb-8 scroll-mt-6"><AccessDiagnosis diagnosis={diagnosis} /></div>}

            <h2 className="mb-3 text-sm font-semibold text-ink">{t("detail.memberships")}</h2>
            <div className="mb-8">
                {memberships.length === 0 ? <p className="text-sm text-ink-muted">{t("detail.noMemberships")}</p> : (
                    <DataTable headers={[{ title: t("columns.organizations") }, { title: t("detail.role") }, { title: t("detail.status") }, { title: t("detail.joined") }]}>
                        {memberships.map(m => (
                            <DataTableRow key={m.clientId}>
                                <DataTableCell>
                                    <Link href={`/superadmin/organizations/${m.clientId}`} className="font-semibold hover:text-accent">{m.name || "—"}</Link>
                                    {m.clientId === user.activeOrganization && <span className="ml-2"><Badge tone="neutral">{t("detail.current")}</Badge></span>}
                                    <p className="text-[11px] text-ink-subtle">{t("detail.departments", { count: m.departments })}</p>
                                </DataTableCell>
                                <DataTableCell>{labelOf(tRoles, m.role)}</DataTableCell>
                                <DataTableCell><Badge tone={m.status === "active" ? "success" : "warning"}>{labelOf(tCommon, m.status)}</Badge></DataTableCell>
                                <DataTableCell className="whitespace-nowrap text-ink-muted">{m.joinedAt ? format.dateTime(m.joinedAt, { dateStyle: "medium" }) : "—"}</DataTableCell>
                            </DataTableRow>
                        ))}
                    </DataTable>
                )}
            </div>

            <h2 className="mb-3 text-sm font-semibold text-ink">{t("detail.audit")}</h2>
            <AuditTable rows={audit} />
        </>
    );
}
