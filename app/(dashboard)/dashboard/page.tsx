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
            <ConsumptionReport title='Consumo global en los departamentos' />
        </div>
    );
}