import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { assignedDepartmentIds, assignedStock } from "@/lib/departments";
import RunnerInventory from "@/components/main/RunnerInventory";
import { SignOut } from "@/components/AuthButtons";

async function NoAssignedAreas() {
    const t = await getTranslations('runner.noAreas');
    return (
        <div className="h-screen flex flex-col items-center justify-center p-10 text-center bg-canvas">
            <div className="w-20 h-20 bg-subtle rounded-3xl flex items-center justify-center text-ink-subtle mb-6">
                <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-black text-ink">{t('title')}</h1>
            <p className="text-base text-ink-muted mt-2 max-w-xs">
                {t('description')}
            </p>
            <SignOut />
        </div>
    );
}

/** Field staff view: stock of the departments the user is assigned to in their active organization. */
export default async function RunnerPage() {
    const session = await auth();
    if (!session?.user) redirect("/");

    const departmentIds = assignedDepartmentIds(session);
    if (departmentIds.length === 0) return <NoAssignedAreas />;

    // A <div>: the (main) layout already renders the page's <main>
    return (
        <div className="min-h-screen bg-canvas">
            <RunnerInventory
                initialItems={await assignedStock(session)}
                assignedAreaCount={departmentIds.length}
            />
        </div>
    );
}
