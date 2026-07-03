import ConsumptionReport from '@/components/admin/consumption';
import Link from "next/link";
import { ArrowLeft } from 'lucide-react';

export default function GeneralReportPage() {
    return (
        <div className="p-6 lg:p-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 print:hidden">
                <Link
                    href="/dashboard"
                    className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-[#171717] transition-colors"
                >
                    <ArrowLeft size={14} /> VOLVER AL DASHBOARD
                </Link>
            </div>
            <ConsumptionReport title="Reporte General de Consumo" />
        </div>
    );
}