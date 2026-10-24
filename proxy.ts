import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { ROLES } from "./lib/constants"

const NO_ADMIN_ACCESS = [ROLES.USER, ROLES.PENDING_USER, ROLES.NEW_USER];

/** Organization pages: the superadmin has no organization (see auth.ts), it goes to its panel instead. */
const ORGANIZATION_PATHS = ["/admin", "/dashboard", "/runner", "/lobby"];

const isUnder = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + "/");

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

    const isSuperadmin = user.role === ROLES.SUPERADMIN;

    // Only the superadmin may open the panel. Its layout and pages check again (requireSuperadmin in lib/superadmin.ts)
    if (isUnder(path, "/superadmin") && !isSuperadmin) {
        return NextResponse.redirect(new URL("/", req.url));
    }
    if (isSuperadmin && ORGANIZATION_PATHS.some(prefix => isUnder(path, prefix))) {
        return NextResponse.redirect(new URL("/superadmin", req.url));
    }

    // High-level role check (Permissions are better checked inside the Page). Users without an approved
    // membership never get past it; roles defined in the DB still reach the page, which checks their permissions.
    if (path.startsWith("/admin") && NO_ADMIN_ACCESS.includes(user.role)) {
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
        '/account/:path*',
        '/superadmin/:path*',
    ]
}
