import { auth } from '@/auth';
import ConsumptionReport from '@/components/admin/consumption';
import { ROLES } from '@/lib/constants';
import { redirect } from 'next/navigation';
export default async function Dashboard() {

    const session = await auth();
    if(session?.user?.role === ROLES.NEW_USER || session?.user?.role === ROLES.PENDING_USER) {
        redirect("/lobby");
    }

    return (
        <div className="p-0 lg:p-10">
            {/* <ConsumptionReport title='Consumo global en los departamentos' /> */}
            {/* add an action card like button for a quick action */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <a href="#" className="flex items-center justify-between gap-4 p-6 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 012-2h6M9 10V5a2 2 0 012-2h6m-3 12h3m-3-4h3m-3-4h3" />
                            </svg>
                        </div>
                        <div>
                            <p>Reportes de consumo</p>
                            <p className="text-xs text-gray-400">Revisa el consumo de tus departamentos</p>
                        </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </a>
            </div>
        </div>
    );
}