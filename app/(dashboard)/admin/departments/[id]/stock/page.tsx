import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getDb, toObjectId } from '@/lib/api';
import { findOwnDepartment } from '@/lib/departments';
import type { StockItem } from '@/types/models';
import StockManagementClient from './StockManagementClient';

export default async function DepartmentStockPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session) redirect("/");

    const departmentId = toObjectId((await params).id);
    const department = departmentId && await findOwnDepartment(session, departmentId);
    if (!department) notFound();

    const db = await getDb();
    const inventory = await db.collection<StockItem>('department_stock')
        .find({ departmentId: department._id, isDeleted: { $ne: true } })
        .toArray();

    return (
        <div className="p-6 lg:p-10">
            <div className="mb-6">
                <h1 className="text-2xl font-black text-[#171717]">
                    Inventario: {department.name}
                </h1>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                    Gestión de existencias y movimientos
                </p>
            </div>

            <StockManagementClient
                initialInventory={inventory.map(item => ({
                    ...item,
                    _id: item._id.toString(),
                    departmentId: item.departmentId.toString(),
                    clientId: item.clientId?.toString(),
                }))}
                departmentId={department._id.toString()}
                departmentName={department.name}
            />
        </div>
    );
}
