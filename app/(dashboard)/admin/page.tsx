import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Page() {
    const session = await auth();
    if (!session) redirect("/");
    return (
        <main>
            <h1>hello from dev</h1>
        </main>
    );
}