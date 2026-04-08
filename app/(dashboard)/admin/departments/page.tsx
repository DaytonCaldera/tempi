import mongo from '@/lib/mongodb';
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DepartmentManagementClient from './DeparmentsManagementClient';
import { ROLES } from '@/lib/constants';

// app/admin/departments/page.tsx
export default async function DepartmentManagementPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);

    const isSuperAdmin = session.user.role === ROLES.SUPERADMIN;
    
    // If Superadmin, get all depts. If Admin, filter by their clientId.
    const query = isSuperAdmin ? {} : { clientId: session.user.clientId };
    console.log(query);
    
    
    const deptsRaw = await db.collection('departments').find(query).toArray();
    
    // Also fetch clients list ONLY if user is Superadmin (for the dropdown)
    let clients:any = [];
    if (isSuperAdmin) {
        const clientsRaw = await db.collection('clients').find({}).toArray();
        clients = clientsRaw.map(c => ({ _id: c._id.toString(), name: c.name }));
    }

    const departments = deptsRaw.map(dept => ({
        ...dept,
        _id: dept._id.toString(),
        clientId: dept.clientId?.toString(),
    }));

    return (
        <div className="p-0 lg:p-10">
            <DepartmentManagementClient 
                initialDepartments={departments} 
                clients={clients}
                userRole={session.user.role}
                userClientId={session.user.clientId}
            />
        </div>
    );
}