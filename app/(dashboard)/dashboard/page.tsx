'use client';
import {Card, CardHeader, CardBody, CardFooter} from '@/components/ui/card';
import styles from './dashboard.module.css';
export default function Dashboard() {
    return (
        <div className={styles.dashboard}>
            <Card variant='default'>
                <CardHeader title='Title for test' />
                <CardBody>
                    This is a test
                </CardBody>
                <CardFooter>
                    <p>Footer content</p>
                </CardFooter> 
            </Card>
        </div>
    );
}