import ConsumptionReport from '@/components/admin/consumption/ConsumptionReport';
import Link from "next/link";
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export default async function GeneralReportPage() {
    const t = await getTranslations('reports');
    return (
        <div className="p-6 lg:p-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 print:hidden">
                <Link
                    href="/dashboard"
                    className="flex items-center gap-2 text-xs font-bold uppercase text-gray-400 hover:text-[#171717] transition-colors"
                >
                    <ArrowLeft size={14} /> {t('backToDashboard')}
                </Link>
            </div>
            <ConsumptionReport title={t('generalTitle')} />
        </div>
    );
}