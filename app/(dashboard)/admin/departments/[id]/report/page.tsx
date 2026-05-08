import ConsumptionReport from '@/components/admin/consumption';
import { ObjectId } from 'mongodb';
import mongo from '@/lib/mongodb';
import Link from "next/link";
import { ArrowLeft, Plus } from 'lucide-react';
export default async function Dashboard({ params }: { params: { id: string } }) {
    const { id } = await params;

    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);
    const department = await db.collection('departments').findOne({
        _id: new ObjectId(id)
    });

    const departmentSerialized = department ? {
        ...department,
        _id: department._id.toString()
    } : null;

    return (
        <div className={"p-6 lg:p-10"}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <Link
                    href={`/admin/departments/${id}/stock`}
                    className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-[#171717] transition-colors"
                >
                    <ArrowLeft size={14} /> VOLVER AL DEPARTAMENTO
                </Link>
            </div>
            <ConsumptionReport deptId={departmentSerialized?._id} title={`Reporte del departamento: ${department?.name}`} />
        </div>
    );
}