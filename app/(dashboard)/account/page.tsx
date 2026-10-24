import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ROLES } from "@/lib/constants";
import { ownedOpenOrganizations } from "@/lib/organizations";
import AccountClient from "./AccountClient";

/**
 * The signed-in user's account: profile, preferences, organizations and account deletion.
 * Works without an active organization, e.g. right after closing the last one (?closed=1).
 */
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ closed?: string }> }) {
    const session = await auth();
    if (!session?.user?.email) redirect("/");

    const [owned, { closed }] = await Promise.all([ownedOpenOrganizations(session.user.email), searchParams]);

    return (
        <div className="p-0 lg:p-10">
            <AccountClient
                ownedOrganizations={owned.map(o => ({ _id: o._id.toString(), name: o.name }))}
                justClosedOrganization={closed === "1"}
                canDeleteAccount={session.user.role !== ROLES.SUPERADMIN}
            />
        </div>
    );
}
