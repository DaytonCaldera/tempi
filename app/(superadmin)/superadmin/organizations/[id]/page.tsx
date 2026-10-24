import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import AuditTable from "@/components/superadmin/AuditTable";
import OrganizationTools, { RestoreOrganization } from "@/components/superadmin/OrganizationTools";
import { Badge, BarChart, Card, PageHeader } from "@/components/superadmin/ui";
import { DataTable, DataTableCell, DataTableRow } from "@/components/ui/DataTable";
import { labelOf } from "@/i18n/labels";
import { ROLES } from "@/lib/constants";
import { getOrganizationDetail, requireSuperadmin } from "@/lib/superadmin";
import { getPlanUsage, listActivePlans } from "@/lib/plans";
import PlanUsageCard from "@/components/admin/PlanUsageCard";
import { toObjectId } from "@/lib/api";

/** One organization: who is in it, what it has, how much it is used, its history, and the support tools. */
export default async function SuperadminOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
    await requireSuperadmin();
    const { id } = await params;
    const clientId = toObjectId(id);
    const [detail, usage, plans] = await Promise.all([
        getOrganizationDetail(id), clientId ? getPlanUsage(clientId) : null, listActivePlans(),
    ]);
    if (!detail || !usage) notFound();

    const [t, tRoles, tCommon, tViewAs, format] = await Promise.all([
        getTranslations("superadmin.organizations"), getTranslations("roles"), getTranslations("common"), getTranslations("superadmin.viewAs"), getFormatter(),
    ]);
    const { organization: org, members, departments, activity, audit } = detail;
    const date = (value: Date | null) => value ? format.dateTime(value, { dateStyle: "medium" }) : "—";

    const facts = [
        { label: t("detail.owner"), value: org.ownerEmail ?? "—" },
        { label: t("detail.plan"), value: org.planName ?? t("detail.noPlan") },
        { label: t("detail.created"), value: date(org.createdAt) },
        { label: t("detail.code"), value: <span className="font-mono">{org.clientCode}</span> },
        { label: t("detail.lastActivity"), value: org.lastActivity ? format.relativeTime(org.lastActivity) : "—" },
    ];

    return (
        <>
            <Link href="/superadmin/organizations" className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-ink-subtle hover:text-ink">
                <ArrowLeft size={14} aria-hidden /> {t("detail.back")}
            </Link>
            <PageHeader title={org.name} subtitle={org.status === "closed" && org.closedAt ? t("detail.closedOn", { date: date(org.closedAt), email: org.closedBy ?? "—" }) : undefined}>
                <div className="flex items-center gap-3">
                    <Badge tone={org.status === "closed" ? "neutral" : "success"}>{t(`status.${org.status}`)}</Badge>
                    <Link href={`/superadmin/organizations/${org._id}/view`} className="inline-flex items-center gap-2 rounded-2xl border border-line bg-card px-4 py-2.5 text-xs font-semibold text-ink hover:border-line-strong">
                        <Eye size={14} aria-hidden /> {tViewAs("button")}
                    </Link>
                </div>
            </PageHeader>

            <dl className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {facts.map(fact => (
                    <div key={fact.label} className="rounded-2xl border border-line bg-card p-4">
                        <dt className="text-xs text-ink-subtle">{fact.label}</dt>
                        <dd className="mt-1 truncate text-sm font-semibold text-ink">{fact.value}</dd>
                    </div>
                ))}
            </dl>

            <div className="mb-8">
                <PlanUsageCard usage={usage} title={t("detail.plan")} />
            </div>

            <div className="mb-8">
                <BarChart title={t("detail.activity")} points={activity} unit="day" />
            </div>

            <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="xl:col-span-2">
                    <h2 className="mb-3 text-sm font-semibold text-ink">{t("detail.members")} · {members.length}</h2>
                    {members.length === 0 ? <p className="text-sm text-ink-muted">{t("detail.noMembers")}</p> : (
                        <DataTable headers={[{ title: t("columns.members") }, { title: t("detail.role") }, { title: t("detail.joined") }, { title: t("detail.lastSeen") }]}>
                            {members.map(member => (
                                <DataTableRow key={member._id}>
                                    <DataTableCell>
                                        <Link href={`/superadmin/users/${member._id}`} className="font-semibold hover:text-accent">{member.name}</Link>
                                        {member.isOwner && <span className="ml-2"><Badge tone="neutral">{t("detail.ownerBadge")}</Badge></span>}
                                        <p className="text-[11px] text-ink-subtle">{member.email}</p>
                                    </DataTableCell>
                                    <DataTableCell>
                                        <p>{labelOf(tRoles, member.role)}</p>
                                        {member.status !== "active" && <p className="text-[11px] text-warning">{labelOf(tCommon, member.status)}</p>}
                                    </DataTableCell>
                                    <DataTableCell className="whitespace-nowrap text-ink-muted">{date(member.joinedAt)}</DataTableCell>
                                    <DataTableCell className="whitespace-nowrap text-ink-muted">{member.lastSeenAt ? format.relativeTime(member.lastSeenAt) : "—"}</DataTableCell>
                                </DataTableRow>
                            ))}
                        </DataTable>
                    )}
                </div>

                <Card title={`${t("detail.departments")} · ${departments.length}`}>
                    {departments.length === 0 ? <p className="text-sm text-ink-muted">{t("detail.noDepartments")}</p> : (
                        <ul className="divide-y divide-line">
                            {departments.map(dept => (
                                <li key={dept._id} className="flex items-center justify-between gap-4 py-2 text-sm">
                                    <span className="truncate text-ink">{dept.name}</span>
                                    <span className="shrink-0 text-xs text-ink-subtle">{t("detail.products", { count: dept.products })}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>

            {org.status === "open" && (
                <div id="tools" className="mb-8 scroll-mt-6">
                    <OrganizationTools
                        clientId={org._id}
                        name={org.name}
                        plans={plans}
                        currentPlanId={usage.plan?._id ?? null}
                        candidates={members
                            .filter(m => !m.isOwner && m.status === "active" && m.role !== ROLES.PENDING_USER)
                            .map(m => ({ _id: m._id, name: m.name, email: m.email }))}
                    />
                </div>
            )}

            {org.status === "closed" && (
                <div id="tools" className="mb-8 scroll-mt-6">
                    <RestoreOrganization clientId={org._id} name={org.name} savedMembers={org.closedMemberships} />
                </div>
            )}

            <h2 className="mb-3 text-sm font-semibold text-ink">{t("detail.audit")}</h2>
            <AuditTable rows={audit} showOrganization={false} />
        </>
    );
}
