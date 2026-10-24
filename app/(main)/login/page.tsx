import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SIGN_IN_METHODS } from "@/lib/auth-methods";
import LoginForm from "./LoginForm";

/**
 * Sign-in page for every method (auth.ts pages.signIn). Auth.js also sends sign-in errors here as ?error=...
 * The enabled methods are read on the server: their env vars aren't available in the browser.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
    const [session, { error, callbackUrl }] = await Promise.all([auth(), searchParams]);

    // Only paths on this site: Auth.js checks redirects too, this keeps the form from even sending another origin
    const redirectTo = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
    // Already signed in (e.g. a paid plan picked on /pricing): go on to where the visitor was headed
    if (session) redirect(redirectTo);

    return <LoginForm methods={SIGN_IN_METHODS} error={error} redirectTo={redirectTo} />;
}
