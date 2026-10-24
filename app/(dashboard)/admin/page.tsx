import { redirect } from "next/navigation";

/** /admin has no page of its own: the admin sections live under it (departments, users, reports). */
export default function Page() {
    redirect("/dashboard");
}
