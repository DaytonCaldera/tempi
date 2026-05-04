import { auth, signOut } from "@/auth";
import mongo from "@/lib/mongodb";
import { redirect } from "next/navigation";
import RunnerInventoryClient from "@/components/main/runner";
import { LayoutDashboard, Link, LogOut } from "lucide-react";
import { ROLES } from "@/lib/constants";

export default async function RunnerPage() {
    const session = await auth();

    // 1. Security Check
    if (!session?.user) redirect("/");

    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);

    // 2. Fetch User to get their assigned departments (Array of IDs)
    const userDoc = await db.collection("users").findOne({
        email: session.user.email
    });
console.log(session.user.permissions);

    // 3. Handle users with no assignments
    const hasValidDepartments = userDoc?.organizations?.some((org:any) => 
        org.departments && org.departments.length > 0
    );

    const userDepartments = userDoc?.organizations?.flatMap((org:any) => org.departments) || [];
    
    if (!hasValidDepartments) {
        return (
            <div className="h-screen flex flex-col items-center justify-center p-10 text-center bg-gray-50">
                <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center text-gray-400 mb-6">
                    <span className="text-3xl">⚠️</span>
                </div>
                <h1 className="text-2xl font-black text-gray-900">Acceso Restringido</h1>
                <p className="text-base text-gray-500 mt-2 max-w-xs">
                    Tu usuario no tiene áreas asignadas. Contacta a un administrador para habilitar tu inventario.
                </p>
            </div>
        );
    }
    
    // 4. Fetch Inventory for all assigned departments
    const inventory = await db.collection("department_stock")
        .find({
            departmentId: { $in: userDepartments }
        })
        .sort({ productName: 1 })
        .toArray();
    
    // 5. Serialize data for Client Component
    const serializedItems = inventory.map(item => ({
        ...item,
        _id: item._id.toString(),
        departmentId: item.departmentId.toString(),
        departmentName: item.departmentName
    }));

    return (
        <main className="min-h-screen bg-gray-50 pb-20">
            {/* Header Area */}
            <div className="bg-white px-6 pt-12 pb-8 rounded-b-[3rem] shadow-sm border-b border-gray-100">
                <div className="max-w-md mx-auto">
                    <h1 className="text-3xl font-black text-[#171717]">Monitoreo de inventario</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                            {userDepartments.length} Áreas asignadas
                        </p>
                    </div>
                </div>
            </div>
            <RunnerInventoryClient initialItems={serializedItems} userRole={session.user.role} permissions={session.user.permissions} />
        </main>
    );
}