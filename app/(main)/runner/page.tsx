import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/api";
import RunnerInventory from "@/components/main/RunnerInventory";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import type { StockItem, User } from "@/types/models";

const NoAssignedAreas = () => (
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

/** Field staff view: stock of the departments the user is assigned to in their active organization. */
export default async function RunnerPage() {
    const session = await auth();
    if (!session?.user) redirect("/");

    const t = await getTranslations('');
    const db = await getDb();

    const userDoc = await db.collection<User>("users").findOne({ email: session.user.email ?? undefined });
    const membership = userDoc?.organizations?.find(m => m.clientId.toString() === session.user.clientId);
    const departmentIds = membership?.departments || [];

    if (departmentIds.length === 0) return <NoAssignedAreas />;

    const inventory = await db.collection<StockItem>("department_stock")
        .find({ departmentId: { $in: departmentIds }, isDeleted: { $ne: true } })
        .sort({ productName: 1 })
        .toArray();

    return (
        <main className="min-h-screen bg-gray-50 pb-20">
            <LanguageSwitcher />
            <div className="bg-white px-6 pt-12 pb-8 rounded-b-[3rem] shadow-sm border-b border-gray-100">
                <div className="max-w-md mx-auto">
                    <h1 className="text-3xl font-black text-[#171717]">{t('runner.title')}</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                            {departmentIds.length} {t('runner.assignedAreas')}
                        </p>
                    </div>
                </div>
            </div>
            <RunnerInventory
                initialItems={inventory.map(item => ({
                    ...item,
                    _id: item._id.toString(),
                    departmentId: item.departmentId.toString(),
                    clientId: item.clientId?.toString(),
                }))}
                userRole={session.user.role}
                permissions={session.user.permissions ?? {}}
            />
        </main>
    );
}
