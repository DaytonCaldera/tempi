import { auth } from '@/auth';
import { PERMISSIONS, ROLES } from '@/lib/constants';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { FileText, ArrowRight, Sparkles } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { planLabel } from '@/i18n/labels';
import { toObjectId } from '@/lib/api';
import { assignedDepartmentIds } from '@/lib/departments';
import { hasPermission } from '@/lib/permissions';
import { daysUntil, getEffectivePlan } from '@/lib/plans';
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

    // Admins see how long a free trial of a plan has left (lib/plans.ts), so its end isn't a surprise
    const clientId = toObjectId(session.user.clientId);
    const effective = clientId && hasPermission(session, PERMISSIONS.MANAGE_USERS) ? await getEffectivePlan(clientId) : null;
    const trialDaysLeft = effective?.source === "trial" && effective.trialEndsAt ? daysUntil(effective.trialEndsAt) : null;

    return (
        <div className="p-0 lg:p-10">
            <h1 className="mb-10 text-3xl font-semibold tracking-tight md:text-4xl">{tCommon('dashboard')}</h1>
            {trialDaysLeft !== null && effective?.plan && (
                <Link href="/admin/plan" className="mb-8 flex flex-wrap items-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-5 py-4 text-sm text-ink hover:border-accent">
                    <Sparkles size={16} className="text-accent" aria-hidden />
                    {tPlan('trialBanner', { days: trialDaysLeft, plan: planLabel(tPlan, effective.plan) })}
                    <span className="font-semibold text-accent">{tPlan('upgradeShort')}</span>
                </Link>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Link
                    href="/admin/reports"
                    className="group flex flex-col rounded-3xl border border-line bg-card p-7 transition hover:border-line-strong hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                    <FileText className="mb-6 h-6 w-6 text-accent" />
                    <h2 className="mb-2 text-xl font-semibold tracking-tight">{t('reportsTitle')}</h2>
                    <p className="leading-relaxed text-ink-muted">{t('reportsDescription')}</p>
                    <ArrowRight className="mt-6 h-4 w-4 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                </Link>
            </div>
            {askStartPage && <StartPagePrompt />}
        </div>
    );
}
