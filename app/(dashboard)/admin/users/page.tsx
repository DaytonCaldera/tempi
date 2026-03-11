import mongo from '@/lib/mongodb';
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/Datatable";
import StatusToggle from "./StatusToggle"; // Your client-side button
import { ROLES } from '@/lib/constants';

export default async function UserManagementPage() {
    // 1. Check permissions
    const session = await auth();
    // if (!session || session.user.role !== ROLES.SUPERADMIN) {
    //     redirect("/unauthorized");
    // }

    // 2. Database Fetch (Dynamic)
    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);
    
    // Fetch all users, project out sensitive fields
    const users = await db.collection('users')
        .find({})
        .project({ password: 0 })
        .toArray();

    return (
        <div className="p-0 lg:p-10 max-w-full mx-auto">
            <DataTable headers={["Usuario", "Rol", "Estado", "Acciones"]}>
                {users.map((user) => (
                    <DataTableRow key={user._id.toString()}>
                        {/* Name & Email */}
                        <DataTableCell>
                            <div className="flex flex-col">
                                <span className="font-bold text-[#171717]">
                                    {user.name || "Usuario sin nombre"}
                                </span>
                                <span className="text-xs text-gray-400">
                                    {user.email}
                                </span>
                            </div>
                        </DataTableCell>

                        {/* Role Badge */}
                        <DataTableCell>
                            <span className="px-2 py-1 rounded bg-gray-100 text-[10px] font-bold uppercase tracking-tight text-gray-500">
                                {user.role}
                            </span>
                        </DataTableCell>

                        {/* Status Dot */}
                        <DataTableCell>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${user.isActive !== false ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="text-xs font-medium text-gray-600">
                                    {user.isActive !== false ? "Activo" : "Inactivo"}
                                </span>
                            </div>
                        </DataTableCell>

                        {/* Action Toggle */}
                        <DataTableCell>
                            <StatusToggle 
                                userId={user._id.toString()} 
                                isActive={user.isActive !== false} 
                            />
                        </DataTableCell>
                    </DataTableRow>
                ))}
            </DataTable>
        </div>
    );
}