import mongo from '@/lib/mongodb';
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import UserManagementClient from "./UserManagementClient";
import { ROLES } from '@/lib/constants';
import { getTenantQuery } from '@/lib/tenant-guard';
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

    const isSuperAdmin = session.user.role === ROLES.SUPERADMIN;
    const query = getTenantQuery(session);


    // 3. Fetch Users
    const usersRaw = await db.collection('users')
        .find(query) // Filter by clientId to ensure they only see their own users
        .project({ password: 0 })
        .toArray();

    const deptsRaw = await db.collection('departments')
        .find(query)
        .toArray();

    // 4. Serialization (Required to move data from Server to Client)
    const users = usersRaw.map(user => ({
        ...user,
        _id: user._id.toString(), // Convert ObjectId to string
        clientId: user.clientId ? user.clientId.toString() : null,
        clientCode: user.clientCode ? user.clientCode.toString() : null,
        // If you have a departments array of ObjectIds, stringify those too
        departments: user.departments?.map((d: any) => d.toString()) || []
    }));


    const departments = deptsRaw.map(dept => ({
        ...dept,
        _id: dept._id.toString(), // Convert ObjectId to string
        clientId: dept.clientId ? dept.clientId.toString() : null,
    }));

    // Render the interactive client component
    return (
        <div className="p-6 lg:p-10">
            <UserManagementClient users={users} departments={departments} />
        </div>
    );
}