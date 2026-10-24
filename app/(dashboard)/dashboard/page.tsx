import { auth } from '@/auth';
import { PERMISSIONS, ROLES } from '@/lib/constants';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { FileText, ArrowRight, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';
import { labelOf, planLabel } from '@/i18n/labels';
import { toObjectId } from '@/lib/api';
import { getDashboardData } from '@/lib/dashboard';
import { getOrganizationCurrency } from '@/lib/organizations';
import { listHeld } from '@/lib/offline-sync-server';
import HeldCard from './HeldCard';
import { assignedDepartmentIds } from '@/lib/departments';
import { hasPermission } from '@/lib/permissions';
import { daysUntil, getEffectivePlan } from '@/lib/plans';
import { BarChart, Card, StatTile } from '@/components/ui/stats';
import StartPagePrompt from '@/components/dashboard/StartPagePrompt';

export default async function Dashboard() {

    const session = await auth();
    if (!session) redirect("/");
    if (!session.user?.role || session.user.role === ROLES.NEW_USER) {
        redirect("/lobby");
    }
    // Pending users wait on the home page, which shows the "pending" screen
    if (session.user.role === ROLES.PENDING_USER) {
        redirect("/");
    }

    // Runners pick once whether they land here or on the runner page after signing in
    const askStartPage = !session.user.startPage && assignedDepartmentIds(session).length > 0;

    const t = await getTranslations('dashboard');
    const tCommon = await getTranslations('common');
    const tPlan = await getTranslations('plan');
    const tUnits = await getTranslations('units');
    const format = await getFormatter();

    // Admins see how long a free trial of a plan has left (lib/plans.ts), so its end isn't a surprise
    const clientId = toObjectId(session.user.clientId);
    const isAdmin = hasPermission(session, PERMISSIONS.MANAGE_USERS);
    const [effective, data, currency, held] = await Promise.all([
        clientId && isAdmin ? getEffectivePlan(clientId) : null,
        getDashboardData(session),
        getOrganizationCurrency(clientId),
        clientId ? listHeld(session) : [],
    ]);
    const trialDaysLeft = effective?.source === "trial" && effective.trialEndsAt ? daysUntil(effective.trialEndsAt) : null;

    const canEditStock = hasPermission(session, PERMISSIONS.EDIT_STOCK);
    const canSeeReports = hasPermission(session, PERMISSIONS.VIEW_REPORTS);
    // Where a low stock product is fixed: its department's stock page, or the runner page for runners
    const stockHref = (departmentId: string) => canEditStock ? `/admin/departments/${departmentId}/stock` : "/runner";
    const amount = (value: number, unit: string) => `${format.number(value)} ${unit ? labelOf(tUnits, unit).toLowerCase() : ""}`.trim();

    return (
        <div className="p-0 lg:p-10">
            <div className="mb-10">
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{tCommon('dashboard')}</h1>
                <p className="mt-1 text-sm text-ink-muted">
                    {data.scope === "organization"
                        ? t('scopeOrganization', { count: data.departmentCount })
                        : t('scopeAssigned', { count: data.departmentCount })}
                </p>
            </div>
            {trialDaysLeft !== null && effective?.plan && (
                <Link href="/admin/plan" className="mb-8 flex flex-wrap items-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-5 py-4 text-sm text-ink hover:border-accent">
                    <Sparkles size={16} className="text-accent" aria-hidden />
                    {tPlan('trialBanner', { days: trialDaysLeft, plan: planLabel(tPlan, effective.plan) })}
                    <span className="font-semibold text-accent">{tPlan('upgradeShort')}</span>
                </Link>
            )}

            {held.length > 0 && <div className="mb-6"><HeldCard held={held} /></div>}

            {data.departmentCount === 0 ? (
                <Card>
                    <p className="text-sm text-ink-muted">{data.scope === "organization" ? t('emptyOrganization') : t('emptyAssigned')}</p>
                    {hasPermission(session, PERMISSIONS.MANAGE_DEPTS) && (
                        <Link href="/admin/departments" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
                            {t('createDepartment')} <ArrowRight size={14} aria-hidden />
                        </Link>
                    )}
                </Card>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatTile label={t('lowStock')} metric={{ value: data.lowStock.total }} hint={t('lowStockHint', { count: data.productCount })} />
                        <StatTile label={t('movements')} metric={data.movements} />
                        <StatTile label={t('activePeople')} metric={data.activePeople} />
                        {data.inventoryValue ? (
                            <StatTile
                                label={t('inventoryValue')}
                                metric={{ value: data.inventoryValue.value }}
                                display={format.number(data.inventoryValue.value, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })}
                                hint={data.inventoryValue.withoutCost > 0
                                    ? t('inventoryValueMissing', { count: data.inventoryValue.withoutCost })
                                    : t('productsHint', { count: data.departmentCount })}
                            />
                        ) : (
                            <StatTile label={t('products')} metric={{ value: data.productCount }} hint={t('productsHint', { count: data.departmentCount })} />
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                            <BarChart title={t('movementsChart')} points={data.series} unit="day" />
                        </div>

                        <Card title={t('lowStockTitle')}>
                            {data.lowStock.items.length === 0 ? (
                                <p className="flex items-center gap-2 text-sm text-ink-muted">
                                    <CheckCircle2 size={16} className="text-success" aria-hidden /> {t('lowStockNone')}
                                </p>
                            ) : (
                                <ul className="divide-y divide-line">
                                    {data.lowStock.items.map(item => (
                                        <li key={item._id}>
                                            <Link href={stockHref(item.departmentId)} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                                                <span className="min-w-0">
                                                    <span className="block truncate text-sm font-semibold text-ink">{item.productName}</span>
                                                    <span className="block truncate text-xs text-ink-subtle">{item.departmentName}</span>
                                                </span>
                                                <span className="shrink-0 text-right text-xs">
                                                    <span className={`flex items-center justify-end gap-1 font-semibold ${item.quantity <= 0 ? "text-danger" : "text-warning"}`}>
                                                        <AlertTriangle size={12} aria-hidden />
                                                        {item.quantity <= 0 ? t('outOfStock') : amount(item.quantity, item.unit)}
                                                    </span>
                                                    <span className="text-ink-subtle">{t('minimum', { amount: amount(item.minStock, item.unit) })}</span>
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {data.lowStock.total > data.lowStock.items.length && (
                                <p className="mt-3 text-xs text-ink-subtle">{t('lowStockMore', { count: data.lowStock.total - data.lowStock.items.length })}</p>
                            )}
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <Card title={t('topConsumed')} className="lg:col-span-2">
                            {data.topConsumed.length === 0 ? (
                                <p className="text-sm text-ink-muted">{t('topConsumedNone')}</p>
                            ) : (
                                <ol className="divide-y divide-line">
                                    {data.topConsumed.map((item, i) => (
                                        <li key={item.inventoryId} className="flex items-center justify-between gap-3 py-2.5">
                                            <span className="flex min-w-0 items-center gap-3">
                                                <span className="w-4 shrink-0 text-xs tabular-nums text-ink-subtle">{i + 1}</span>
                                                <span className="min-w-0">
                                                    <span className="block truncate text-sm font-semibold text-ink">{item.productName}</span>
                                                    <span className="block truncate text-xs text-ink-subtle">{item.departmentName}</span>
                                                </span>
                                            </span>
                                            <span className="shrink-0 text-right">
                                                <span className="block text-sm font-semibold tabular-nums text-ink">{amount(item.amount, item.unit)}</span>
                                                {item.value !== null && item.value > 0 && (
                                                    <span className="block text-xs tabular-nums text-ink-subtle">{format.number(item.value, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })}</span>
                                                )}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </Card>

                        {canSeeReports && (
                            <Link
                                href="/admin/reports"
                                className="group flex flex-col rounded-3xl border border-line bg-card p-7 transition hover:border-line-strong hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            >
                                <FileText className="mb-6 h-6 w-6 text-accent" />
                                <h2 className="mb-2 text-xl font-semibold tracking-tight">{t('reportsTitle')}</h2>
                                <p className="leading-relaxed text-ink-muted">{t('reportsDescription')}</p>
                                <ArrowRight className="mt-6 h-4 w-4 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                            </Link>
                        )}
                    </div>
                </div>
            )}
            {askStartPage && <StartPagePrompt />}
        </div>
    );
}
