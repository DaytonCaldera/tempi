import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { ROLES } from "./lib/constants"

export default auth((req) => {
    // 1. Access the session via req.auth
    const session = req.auth;
    const user = session?.user;

    const isAuth = !!session;
    const path = req.nextUrl.pathname;
    const isAuthPage = path.startsWith('/login');

    ///api/auth/signin?callbackUrl=F%2

    if (user && user.isActive === false) {
        return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    const isLoggedIn = !!auth;
    const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");

    if (isAdminRoute && !isLoggedIn) {
        return Response.redirect(new URL("/login", req.nextUrl));
    }

    // High-level role check (Permissions are better checked inside the Page)
    if (isAdminRoute && user?.role === 'user') {
        return Response.redirect(new URL("/unauthorized", req.nextUrl));
    }

    // if (path.startsWith('/admin') && user?.role !== ROLES.SUPERADMIN) {
    //     return NextResponse.redirect(new URL('/unauthorized', req.url))
    // }

    // Dashboard specific checks
    // if (path.startsWith('/dashboard')) {
    //     if (!user || [ROLES.NEW_USER, ROLES.PENDING_USER].includes(user.role)) {
    //         return NextResponse.redirect(new URL('/unauthorized', req.url))
    //     }
    // }

    // Redirect authenticated users away from login page
    if (isAuthPage) {
        if (isAuth) {
            return NextResponse.redirect(new URL('/dashboard', req.url))
        }
        return NextResponse.next();
    }

    // Redirect unauthenticated users to login
    if (!isAuth) {
        let from = path;
        if (req.nextUrl.search) {
            from += req.nextUrl.search;
        }

        return NextResponse.redirect(
            new URL(`/auth/login?from=${encodeURIComponent(from)}`, req.url)
        );
    }

    return NextResponse.next();
})

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/profile/:path*',
        '/admin/:path*',
    ]
}