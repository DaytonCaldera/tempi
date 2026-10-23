import Link from "next/link";
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { toObjectId } from '@/lib/api';
import { findOwnDepartment } from '@/lib/departments';
import ConsumptionReport from '@/components/admin/consumption/ConsumptionReport';

export default async function DepartmentReportPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session) redirect("/");

    const departmentId = toObjectId((await params).id);
    const department = departmentId && await findOwnDepartment(session, departmentId);
    if (!department) notFound();

    const id = department._id.toString();
    const t = await getTranslations('reports');

    return (
        <div className="p-6 lg:p-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <Link
                    href={`/admin/departments/${id}/stock`}
                    className="flex items-center gap-2 text-xs font-bold uppercase text-gray-400 hover:text-[#171717] transition-colors"
                >
                    <ArrowLeft size={14} /> {t('backToDepartment')}
                </Link>
            </div>
            <ConsumptionReport deptId={id} title={t('departmentTitle', { name: department.name })} />
        </div>
    );
}
