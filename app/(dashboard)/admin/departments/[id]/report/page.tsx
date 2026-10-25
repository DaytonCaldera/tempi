import Link from "next/link";
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { toObjectId } from '@/lib/api';
import { PERMISSIONS, PLAN_FEATURES } from '@/lib/constants';
import { findOwnDepartment } from '@/lib/departments';
import { hasPlanFeature } from '@/lib/plans';
import { getOrganizationCurrency } from '@/lib/organizations';
import { hasPermission } from '@/lib/permissions';
import ConsumptionReport from '@/components/admin/consumption/ConsumptionReport';

export default async function DepartmentReportPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session) redirect("/");
    if (!hasPermission(session, PERMISSIONS.VIEW_REPORTS)) redirect("/unauthorized");

    const departmentId = toObjectId((await params).id);
    const department = departmentId && await findOwnDepartment(session, departmentId);
    if (!department) notFound();

    const id = department._id.toString();
    const t = await getTranslations('reports');

    return (
        <div className="p-6 lg:p-10">
            {/* The stock page needs EDIT_STOCK: a role that only sees reports has nowhere to go back to */}
            {hasPermission(session, PERMISSIONS.EDIT_STOCK) && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                    <Link
                        href={`/admin/departments/${id}/stock`}
                        className="flex items-center gap-2 text-xs font-bold uppercase text-ink-subtle hover:text-ink transition-colors"
                    >
                        <ArrowLeft size={14} /> {t('backToDepartment')}
                    </Link>
                </div>
            )}
            <ConsumptionReport
                deptId={id}
                title={t('departmentTitle', { name: department.name })}
                canExport={await hasPlanFeature(department.clientId, PLAN_FEATURES.EXPORT_CSV)}
                currency={await getOrganizationCurrency(department.clientId)}
            />
        </div>
    );
}
