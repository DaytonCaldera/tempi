import ConsumptionReport from '@/components/admin/consumption/ConsumptionReport';
import Link from "next/link";
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { toObjectId } from '@/lib/api';
import { PERMISSIONS, PLAN_FEATURES } from '@/lib/constants';
import { hasPermission } from '@/lib/permissions';
import { hasPlanFeature } from '@/lib/plans';
import { getOrganizationCurrency } from '@/lib/organizations';

export default async function GeneralReportPage() {
    const session = await auth();
    if (!session) redirect("/");
    if (!hasPermission(session, PERMISSIONS.VIEW_REPORTS)) redirect("/unauthorized");

    const t = await getTranslations('reports');
    const clientId = toObjectId(session.user.clientId);
    return (
        <div className="p-6 lg:p-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 print:hidden">
                <Link
                    href="/dashboard"
                    className="flex items-center gap-2 text-xs font-bold uppercase text-ink-subtle hover:text-ink transition-colors"
                >
                    <ArrowLeft size={14} /> {t('backToDashboard')}
                </Link>
            </div>
            <ConsumptionReport
                title={t('generalTitle')}
                canExport={!!clientId && await hasPlanFeature(clientId, PLAN_FEATURES.EXPORT_CSV)}
                currency={await getOrganizationCurrency(clientId)}
            />
        </div>
    );
}
