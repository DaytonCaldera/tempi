import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { getDb, toObjectId } from '@/lib/api';
import { PERMISSIONS } from '@/lib/constants';
import { findOwnDepartment } from '@/lib/departments';
import { hasPermission } from '@/lib/permissions';
import { normalizeBarcode } from '@/lib/sku';
import type { Department, StockItem } from '@/types/models';
import StockManagementClient from './StockManagementClient';

export default async function DepartmentStockPage({ params, searchParams }: {
    params: Promise<{ id: string }>;
    /** barcode: a code the runner scanned and didn't find, to create the product with it */
    searchParams: Promise<{ barcode?: string }>;
}) {
    const session = await auth();
    if (!session) redirect("/");
    if (!hasPermission(session, PERMISSIONS.EDIT_STOCK)) redirect("/unauthorized");

    const departmentId = toObjectId((await params).id);
    const department = departmentId && await findOwnDepartment(session, departmentId);
    if (!department) notFound();

    const t = await getTranslations('stock');
    const db = await getDb();
    const [inventory, otherDepartments] = await Promise.all([
        db.collection<StockItem>('department_stock')
            .find({ departmentId: department._id, isDeleted: { $ne: true } })
            .toArray(),
        // Where its products can be transferred to
        db.collection<Department>('departments')
            .find({ clientId: department.clientId, _id: { $ne: department._id } }, { projection: { name: 1 } })
            .sort({ name: 1 })
            .toArray(),
    ]);

    return (
        <div className="p-6 lg:p-10">
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-ink">
                    {t('pageTitle', { name: department.name })}
                </h1>
                <p className="text-xs font-bold text-ink-subtle uppercase tracking-widest mt-1">
                    {t('pageSubtitle')}
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
                otherDepartments={otherDepartments.map(d => ({ _id: d._id.toString(), name: d.name }))}
                newBarcode={normalizeBarcode((await searchParams).barcode) || undefined}
            />
        </div>
    );
}
