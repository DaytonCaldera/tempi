import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb, toObjectId } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { PERMISSIONS } from '@/lib/constants';
import { getPlanUsage } from '@/lib/plans';
import { getTenantQuery } from '@/lib/tenant-guard';
import PlanUsageCard from '@/components/admin/PlanUsageCard';
import DepartmentsManagementClient from './DepartmentsManagementClient';

export default async function DepartmentsManagementPage() {
    const session = await auth();
    if (!session) redirect("/");
    if (!hasPermission(session, "manage_departments")) redirect("/unauthorized");

    const db = await getDb();
    const clientId = toObjectId(session.user.clientId);
    const [departments, usage] = await Promise.all([
        db.collection('departments').find(getTenantQuery(session)).toArray(),
        clientId ? getPlanUsage(clientId) : null,
    ]);

    return (
        <div className="p-0 lg:p-10">
            {/* The plan page needs MANAGE_USERS, which a role can lack while managing departments */}
            {usage && <div className="mb-8"><PlanUsageCard usage={usage} upgradeLink={hasPermission(session, PERMISSIONS.MANAGE_USERS)} /></div>}
            <DepartmentsManagementClient
                departments={departments.map(dept => ({
                    _id: dept._id.toString(),
                    name: dept.name,
                    description: dept.description,
                    clientId: dept.clientId?.toString(),
                }))}
                userClientId={session.user.clientId}
            />
        </div>
    );
}
