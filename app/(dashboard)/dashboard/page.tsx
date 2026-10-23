import { auth } from '@/auth';
import { ROLES } from '@/lib/constants';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { FileText, ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

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

    const t = await getTranslations('dashboard');

    return (
        <div className="p-0 lg:p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Link
                    href="/admin/reports"
                    className="group flex items-center justify-between gap-4 p-8 bg-brand text-white rounded-[2.5rem] shadow-xl shadow-brand/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
                            <FileText size={26} className="text-brand-accent" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-black uppercase tracking-widest">{t('reportsTitle')}</p>
                            <p className="text-xs font-bold text-white/50">{t('reportsDescription')}</p>
                        </div>
                    </div>
                    <div className="w-10 h-10 bg-brand-accent text-brand rounded-xl flex items-center justify-center shrink-0 group-hover:translate-x-1 transition-transform">
                        <ArrowRight size={18} strokeWidth={3} />
                    </div>
                </Link>
            </div>
        </div>
    );
}