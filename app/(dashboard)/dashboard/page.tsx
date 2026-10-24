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
    const tCommon = await getTranslations('common');

    return (
        <div className="p-0 lg:p-10">
            <h1 className="mb-10 text-3xl font-semibold tracking-tight md:text-4xl">{tCommon('dashboard')}</h1>
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
        </div>
    );
}
