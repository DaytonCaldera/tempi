import { listCatalogPlans, type PlanSummary } from "@/lib/plans";
import Home from "./Home";

// The catalog is edited from /superadmin/plans: always read it fresh (same as /pricing)
export const dynamic = "force-dynamic";

/** Loads the plans shown in the landing's pricing section. Without them the landing still renders, minus that section. */
export default async function HomePage() {
    let plans: PlanSummary[] = [];
    try {
        plans = await listCatalogPlans();
    } catch (error) {
        console.error("Home page plans error:", error);
    }
    return <Home plans={plans} />;
}
