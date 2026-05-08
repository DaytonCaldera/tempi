import mongo from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { notFound } from 'next/navigation';
import StockManagementClient from './StockManagementClient';

export default async function DepartmentStockPage({ params }: { params: { id: string } }) {
    const { id } = await params;

    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);

    // 1. Fetch Department Details
    const department = await db.collection('departments').findOne({ 
        _id: new ObjectId(id) 
    });

    if (!department) notFound();

    const inventoryRaw = await db.collection('department_stock')
        .find({ departmentId: new ObjectId(id) })
        .toArray();

    const inventory = inventoryRaw.map(item => ({
        ...item,
        _id: item._id.toString(),
        productId: item._id.toString(),
        departmentId: item.departmentId.toString(),
        clientId: item.clientId.toString(),
    }));

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
                initialInventory={inventory} 
                departmentId={id} 
                departmentName={department.name}
            />
        </div>
    );
}