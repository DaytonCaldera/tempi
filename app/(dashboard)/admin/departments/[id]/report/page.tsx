import ConsumptionReport from '@/components/admin/consumption';
import { ObjectId } from 'mongodb';
import mongo from '@/lib/mongodb';
export default async function Dashboard({ params }: { params: { id: string } }) {
    const { id } = await params;

    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);
    const department = await db.collection('departments').findOne({
        _id: new ObjectId(id)
    });

    return (
        <div className={"p-6 lg:p-10"}>
            <ConsumptionReport deptId={id} title={`Reporte del departamento: ${department?.name}`} />
        </div>
    );
}