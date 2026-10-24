import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { BarChart, Card, FunnelChart, hrefWith, PageHeader, Segmented, StatTile } from "@/components/superadmin/ui";
import { DEFAULT_PERIOD, getOverview, isPeriodKey, PERIODS, requireSuperadmin } from "@/lib/superadmin";
import { FUNNEL_STEPS, getActiveUsers, getFunnel, getHealthCounts } from "@/lib/superadmin-insights";

/**
 * Overview of the whole app: active users, usage and growth in a period, the onboarding funnel of that period,
 * and what needs attention now (the counts of the health page).
 */
export default async function SuperadminOverviewPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
    await requireSuperadmin();
    const { period: requested } = await searchParams;
    const period = isPeriodKey(requested) ? requested : DEFAULT_PERIOD;

    const [t, format, overview, active, funnel, attention] = await Promise.all([
        getTranslations("superadmin"), getFormatter(), getOverview(period), getActiveUsers(), getFunnel(period), getHealthCounts(),
    ]);
    const { metrics, totals, series, range } = overview;
    const m = (key: keyof typeof metrics) => t(`overview.metrics.${key}`);

    const totalTiles = [
        { label: t("overview.totals.totalUsers"), value: totals.totalUsers, href: "/superadmin/users" },
        { label: t("overview.totals.openOrganizations"), value: totals.openOrganizations, href: "/superadmin/organizations" },
        { label: t("overview.totals.usersWithoutOrganization"), value: totals.usersWithoutOrganization, href: "/superadmin/users?filter=noOrganization" },
        {
            label: t("overview.totals.pendingMembers"), value: totals.pendingMembers, href: "/superadmin/users?filter=pending",
            note: totals.oldestPendingSince && t("overview.totals.oldestPending", { date: format.dateTime(totals.oldestPendingSince, { dateStyle: "medium" }) }),
        },
    ];

    const trackingNote = active.trackingSince
        ? t("overview.trackingSince", { date: format.dateTime(new Date(`${active.trackingSince}T12:00:00Z`), { dateStyle: "medium", timeZone: "UTC" }) })
        : t("overview.notTrackedYet");
    const attentionItems = (Object.entries(attention) as [keyof typeof attention, number][]).filter(([, count]) => count > 0);

    return (
        <>
            <PageHeader title={t("overview.title")} subtitle={t("overview.subtitle")}>
                <Segmented
                    label={t("periodLabel")}
                    current={period}
                    options={Object.keys(PERIODS).map(key => ({ value: key, label: t(`periods.${key}`) }))}
                    hrefFor={value => hrefWith("/superadmin", { period: value === DEFAULT_PERIOD ? undefined : value })}
                />
            </PageHeader>

            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-subtle">{t("overview.activeUsers")}</h2>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label={t("overview.dau")} metric={{ value: active.dau }} hint={trackingNote} />
                <StatTile label={t("overview.wau")} metric={{ value: active.wau }} hint={trackingNote} />
                <StatTile label={t("overview.mau")} metric={{ value: active.mau }} hint={trackingNote} />
                <StatTile
                    label={t("overview.stickiness")}
                    metric={{ value: active.stickiness ?? 0 }}
                    display={active.stickiness === null ? "—" : format.number(active.stickiness, { style: "percent" })}
                    hint={t("overview.stickinessHint")}
                />
            </div>
            <div className="mb-8">
                <BarChart title={t("overview.dauChart")} points={active.series} unit="day" />
            </div>

            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-subtle">{t("overview.usage")}</h2>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label={m("seenUsers")} metric={metrics.seenUsers} hint={t("overview.metrics.seenUsersHint")} />
                <StatTile label={m("workingUsers")} metric={metrics.workingUsers} />
                <StatTile label={m("activeOrganizations")} metric={metrics.activeOrganizations} />
                <StatTile label={m("movements")} metric={metrics.movements} />
            </div>

            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-subtle">{t("overview.growth")}</h2>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label={m("newUsers")} metric={metrics.newUsers} />
                <StatTile label={m("newOrganizations")} metric={metrics.newOrganizations} />
                <StatTile label={m("closedOrganizations")} metric={metrics.closedOrganizations} upIsGood={false} />
                <StatTile label={m("signIns")} metric={metrics.signIns} hint={t("overview.metrics.signInsHint")} />
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <BarChart title={t("overview.charts.movements")} points={series.movements} unit={range.unit} />
                <BarChart title={t("overview.charts.signUps")} points={series.signUps} unit={range.unit} />
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card title={t("overview.funnel")}>
                    <p className="-mt-2 mb-4 text-xs text-ink-subtle">{t("overview.funnelHint")}</p>
                    <FunnelChart steps={FUNNEL_STEPS.map(step => ({ label: t(`overview.funnelSteps.${step}`), value: funnel[step] }))} />
                </Card>
                <Card title={t("overview.attention")}>
                    {attentionItems.length === 0 ? <p className="text-sm text-ink-muted">{t("overview.attentionNone")}</p> : (
                        <ul className="divide-y divide-line">
                            {attentionItems.map(([key, count]) => (
                                <li key={key}>
                                    <Link href={`/superadmin/health#${key}`} className="flex items-center justify-between gap-4 py-2.5 text-sm hover:text-accent">
                                        <span>{t(`health.${key}`)}</span>
                                        <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-warning">{format.number(count)}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                    <Link href="/superadmin/health" className="mt-4 inline-block text-xs font-semibold text-ink-muted hover:text-ink">{t("overview.seeHealth")} →</Link>
                </Card>
            </div>

            <Card title={t("overview.totals.title")}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {totalTiles.map(tile => (
                        <Link key={tile.label} href={tile.href} className="rounded-2xl border border-line p-4 transition-colors hover:border-line-strong">
                            <p className="text-sm text-ink-muted">{tile.label}</p>
                            <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{format.number(tile.value)}</p>
                            {tile.note && <p className="mt-1 text-xs text-ink-subtle">{tile.note}</p>}
                        </Link>
                    ))}
                </div>
            </Card>
        </>
    );
}
