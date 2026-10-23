import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from '@/lib/api';
import { ROLES } from '@/lib/constants';
import { hasPermission } from '@/lib/permissions';
import { getTenantQuery } from '@/lib/tenant-guard';
import DepartmentsManagementClient from './DepartmentsManagementClient';

export default async function DepartmentsManagementPage() {
    const session = await auth();
    if (!session) redirect("/");
    if (!hasPermission(session, "manage_departments")) redirect("/unauthorized");

    const db = await getDb();
    const departments = await db.collection('departments').find(getTenantQuery(session)).toArray();

    // Superadmins pick the organization of a new department from a dropdown
    const clients = session.user.role === ROLES.SUPERADMIN
        ? (await db.collection('clients').find({}).toArray()).map(c => ({ _id: c._id.toString(), name: c.name }))
        : [];

    return (
        <div className="p-0 lg:p-10">
            <DepartmentsManagementClient
                departments={departments.map(dept => ({
                    _id: dept._id.toString(),
                    name: dept.name,
                    description: dept.description,
                    clientId: dept.clientId?.toString(),
                }))}
                clients={clients}
                userRole={session.user.role}
                userClientId={session.user.clientId}
            />
        </div>
    );
}
