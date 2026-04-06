'use client';
import ConsumptionReport from '@/components/admin/consumption';
import GroupedConsumptionReport from '@/components/admin/consumptionByDept';
export default function Dashboard() {



    return (
        <div className="p-0 lg:p-10">
            <ConsumptionReport title='Consumo global en los departamentos' />
        </div>
    );
}