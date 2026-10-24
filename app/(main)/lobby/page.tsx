import { isBillingInterval } from "@/lib/checkout";
import Lobby from "./Lobby";

/**
 * Create or join an organization. /checkout sends visitors here with ?plan=&interval= when they picked a paid
 * plan before having one: creating it then goes back to /checkout to pay.
 */
export default async function LobbyPage({ searchParams }: { searchParams: Promise<{ plan?: string; interval?: string }> }) {
    const { plan, interval } = await searchParams;
    const checkoutIntent = plan && /^[a-f0-9]{24}$/i.test(plan)
        ? new URLSearchParams({ plan, interval: isBillingInterval(interval) ? interval : "monthly" }).toString()
        : null;
    return <Lobby checkoutIntent={checkoutIntent} />;
}
