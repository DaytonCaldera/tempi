'use client';
import {Card, CardHeader, CardBody, CardFooter} from '@/components/ui/card';
import styles from './dashboard.module.css';
import ConsumptionReport from '@/components/admin/consumption';
export default function Dashboard() {
    return (
        <div className={styles.dashboard}>
            <ConsumptionReport title='Consumo global en los departamentos' />
        </div>
    );
}