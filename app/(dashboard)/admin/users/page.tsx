import mongo from '@/lib/mongodb';
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import UserManagementClient from "./UserManagementClient";
import { ROLES } from '@/lib/constants';
import { getClientTenantQuery, getTenantQuery, getUserTenantQuery } from '@/lib/tenant-guard';
import { hasPermission } from '@/lib/hasPermissions';

export default async function UserManagementPage() {
    const session = await auth();

    if (!hasPermission(session, "manage_users")) {
        redirect("/unauthorized"); // Or back to dashboard
    }

    // 1. Security Check
    if (!session) redirect("/login");

    // 2. Database Connection
    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);

    const query = getTenantQuery(session);
    const userQuery = getUserTenantQuery(session);
    const clientQuery = getClientTenantQuery(session);


    // 3. Fetch Users
    const usersRaw = await db.collection('users').find(userQuery).toArray();
    

    const deptsRaw = await db.collection('departments')
        .find(query)
        .toArray();

    // 4. Serialization (Required to move data from Server to Client)
    const users = usersRaw.map(user => {
        // 1. Find the specific organization object for the current session
        const currentOrg = user.organizations?.find(
            (org: any) => org.clientId?.toString() === session.user.clientId
        );

        return {
            _id: user._id.toString(),
            // Use the top-level clientId from the session or the matched org
            clientId: session.user.clientId,

            // Flatten specific fields from the matched organization
            role: currentOrg?.role || user.role,
            status: currentOrg?.status || (user.isActive ? 'active' : 'inactive'),
            clientName: currentOrg?.clientName || null,

            // Convert activeOrganization and clientCode if they exist
            activeOrganization: user.activeOrganization ? user.activeOrganization.toString() : null,
            clientCode: currentOrg?.clientCode || (user.clientCode ? user.clientCode.toString() : null),

            // Stringify departments from the matched organization specifically
            departments: currentOrg?.departments?.map((d: any) => d.toString()) || [],
            name: user.name,
            email: user.email,
            image: user.image,
        };
    });


    const departments = deptsRaw.map(dept => ({
        ...dept,
        _id: dept._id.toString(), // Convert ObjectId to string
        clientId: dept.clientId ? dept.clientId.toString() : null,
    }));

    // 5. Fetch Current Client Data
    const currentClientData = await db.collection('clients').find(clientQuery).project({ clientCode: 1, name: 1, _id: 1 }).toArray();
    const serializedClientData = currentClientData.map(client => ({
        _id: client._id.toString(),
        code: client.clientCode,
        name: client.name,
    }));

    // Render the interactive client component
    return (
        <div className="p-6 lg:p-10">
            <UserManagementClient users={users} departments={departments} client={serializedClientData[0]} />
        </div>
    );
}