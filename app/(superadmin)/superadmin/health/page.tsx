import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card, PageHeader } from "@/components/superadmin/ui";
import { INACTIVE_AFTER_DAYS, requireSuperadmin } from "@/lib/superadmin";
import { getHealth, HEALTH_THRESHOLDS } from "@/lib/superadmin-insights";

/** Alert lists: who may need help, each item linking to its user or organization page. */
export default async function SuperadminHealthPage() {
    await requireSuperadmin();
    const [t, format, health] = await Promise.all([getTranslations("superadmin.health"), getFormatter(), getHealth()]);
    const date = (value: Date) => format.dateTime(value, { dateStyle: "medium" });

    // One card per list. `id` is the anchor the overview's "Needs attention" links to.
    const sections = [
        {
            id: "inactiveOrganizations", hint: t("inactiveOrganizationsHint", { days: INACTIVE_AFTER_DAYS }), count: health.inactiveOrganizations.total,
            items: health.inactiveOrganizations.rows.map(org => ({
                key: org._id, href: `/superadmin/organizations/${org._id}`, title: org.name,
                detail: org.lastActivity ? t("lastActivity", { date: date(org.lastActivity) }) : t("neverActive"),
            })),
            more: health.inactiveOrganizations.total > health.inactiveOrganizations.rows.length ? "/superadmin/organizations?filter=inactive" : null,
        },
        {
            id: "longPending", hint: t("longPendingHint", { days: HEALTH_THRESHOLDS.pendingDays }), count: health.longPending.length,
            items: health.longPending.map(row => ({
                key: `${row.userId}-${row.clientId}`, href: `/superadmin/users/${row.userId}`, title: `${row.name || row.email} · ${row.organization}`,
                detail: t("waitingSince", { date: date(row.since) }),
            })),
        },
        {
            id: "lobbyUsers", hint: t("lobbyUsersHint", { days: HEALTH_THRESHOLDS.lobbyDays }), count: health.lobbyUsers.length,
            items: health.lobbyUsers.map(user => ({
                key: user._id, href: `/superadmin/users/${user._id}`, title: user.name || user.email, detail: t("registeredOn", { date: date(user.createdAt) }),
            })),
        },
        {
            id: "loneOrganizations", hint: t("loneOrganizationsHint", { days: HEALTH_THRESHOLDS.newOrganizationDays }), count: health.loneOrganizations.length,
            items: health.loneOrganizations.map(org => ({ key: org._id, href: `/superadmin/organizations/${org._id}`, title: org.name, detail: org.ownerEmail ?? "" })),
        },
        {
            id: "emptyOrganizations", hint: t("emptyOrganizationsHint", { days: HEALTH_THRESHOLDS.newOrganizationDays }), count: health.emptyOrganizations.length,
            items: health.emptyOrganizations.map(org => ({ key: org._id, href: `/superadmin/organizations/${org._id}`, title: org.name, detail: org.ownerEmail ?? "" })),
        },
        {
            id: "stockMismatches", hint: t("stockMismatchesHint"), count: health.stockMismatches.length,
            items: health.stockMismatches.map(item => ({
                key: item._id, href: item.clientId ? `/superadmin/organizations/${item.clientId}` : null,
                title: `${item.productName} (${item.sku}) · ${item.departmentName} · ${item.organization}`,
                detail: t("quantity", { quantity: format.number(item.quantity), calculated: format.number(item.calculated) }),
            })),
        },
    ];

    return (
        <>
            <PageHeader title={t("title")} subtitle={t("subtitle")} />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {sections.map(section => (
                    <section key={section.id} id={section.id} className="scroll-mt-6">
                        <Card
                            title={
                                <span className="flex items-center justify-between gap-4">
                                    <span>{t(section.id)}</span>
                                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${section.count ? "bg-warning/10 text-warning" : "bg-subtle text-ink-subtle"}`}>{format.number(section.count)}</span>
                                </span>
                            }
                        >
                            <p className="-mt-2 mb-3 text-xs text-ink-subtle">{section.hint}</p>
                            {section.items.length === 0 ? <p className="text-sm text-ink-muted">{t("none")}</p> : (
                                <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                                    {section.items.map(item => (
                                        <li key={item.key} className="py-2">
                                            {item.href ? <Link href={item.href} className="text-sm font-semibold text-ink hover:text-accent">{item.title}</Link> : <p className="text-sm font-semibold text-ink">{item.title}</p>}
                                            {item.detail && <p className="text-xs text-ink-subtle">{item.detail}</p>}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {"more" in section && section.more && <Link href={section.more} className="mt-3 inline-block text-xs font-semibold text-ink-muted hover:text-ink">{t("seeAll")} →</Link>}
                        </Card>
                    </section>
                ))}
            </div>
        </>
    );
}
