import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb, toObjectId } from '@/lib/api';
import { LEGAL, ROLES } from '@/lib/constants';
import { getPlanUsage } from '@/lib/plans';
import PlanUsageCard from '@/components/admin/PlanUsageCard';
import { hasPermission } from '@/lib/permissions';
import { getClientTenantQuery, getTenantQuery, getUserTenantQuery } from '@/lib/tenant-guard';
import { canCloseOrganization, OPEN_ORGANIZATION, otherActiveMemberships } from '@/lib/organizations';
import type { Organization, User } from '@/types/models';
import UserManagementClient, { type UserRow } from "./UserManagementClient";

export default async function UserManagementPage() {
    const session = await auth();
    if (!session) redirect("/");
    if (!hasPermission(session, "manage_users")) redirect("/unauthorized");

    const db = await getDb();
    const [usersRaw, departmentsRaw, organization] = await Promise.all([
        db.collection<User>('users').find(getUserTenantQuery(session)).toArray(),
        db.collection('departments').find(getTenantQuery(session)).toArray(),
        db.collection<Organization>('clients').findOne({ ...getClientTenantQuery(session), ...OPEN_ORGANIZATION }, { projection: { clientCode: 1, name: 1, ownerEmail: 1 } }),
    ]);

    // Flatten each user's membership in the current organization
    const users: UserRow[] = usersRaw.map(user => {
        const membership = user.organizations?.find(m => m.clientId.toString() === session.user.clientId);
        const role = membership?.role || ROLES.NEW_USER;
        return {
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
            image: user.image,
            clientId: session.user.clientId,
            role,
            isPending: role === ROLES.PENDING_USER,
            isActive: membership?.status === 'active',
            departments: membership?.departments?.map(id => id.toString()) || [],
        };
    });

    const departments = departmentsRaw.map(dept => ({ _id: dept._id.toString(), name: dept.name as string }));
    const clientId = toObjectId(session.user.clientId);
    const usage = clientId ? await getPlanUsage(clientId) : null;

    return (
        <div className="p-6 lg:p-10">
            {usage && <div className="mb-8"><PlanUsageCard usage={usage} contactEmail={LEGAL.contactEmail} /></div>}
            <UserManagementClient
                users={users}
                departments={departments}
                client={organization ? { _id: organization._id.toString(), code: organization.clientCode, name: organization.name } : null}
                canCloseOrganization={!!organization && !!session.user.clientId && canCloseOrganization(session, organization)}
                isLastOrganization={otherActiveMemberships(session.user.organizations, session.user.clientId ?? "").length === 0}
            />
        </div>
    );
}
