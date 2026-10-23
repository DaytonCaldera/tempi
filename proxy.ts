import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { ROLES } from "./lib/constants"

// Locale is read from the NEXT_LOCALE cookie in i18n/request.ts. The next-intl middleware isn't used here:
// with localePrefix 'never' it rewrites to /[locale]/... routes, which this app doesn't have.
export default auth((req) => {
    const user = req.auth?.user;
    const path = req.nextUrl.pathname;

    // Not signed in: the home page is the landing page with the sign-in button
    if (!user) {
        return NextResponse.redirect(new URL("/", req.url));
    }

    if (user.isActive === false) {
        return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    // High-level role check (Permissions are better checked inside the Page)
    if (path.startsWith("/admin") && user.role === ROLES.USER) {
        return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    return NextResponse.next();
})

export const config = {
    // Only routes that need a session. "/" and "/unauthorized" must stay public, otherwise they redirect to themselves.
    matcher: [
        '/admin/:path*',
        '/dashboard/:path*',
        '/runner/:path*',
        '/lobby/:path*',
    ]
}
