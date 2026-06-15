import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { ROLES } from "./lib/constants"
import createMiddleware from "next-intl/middleware";

const i18nMiddleware = createMiddleware({
  locales: ['es', 'en'],
  defaultLocale: 'es',
  // Esto es clave: oculta el prefijo de la URL siempre
  localePrefix: 'never' 
});

export default auth((req) => {
    // 1. Access the session via req.auth
    const session = req.auth;
    const user = session?.user;

    const isAuth = !!session;
    const path = req.nextUrl.pathname;
    const isAuthPage = path.startsWith('/login');

    ///api/auth/signin?callbackUrl=F%2

    if (path.startsWith('/api') || path.includes('.')) {
        return NextResponse.next();
    }

    const response = i18nMiddleware(req);
    
    if (path === '/unauthorized') return response;

    if (user && user.isActive === false) {
        return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    const isLoggedIn = !!isAuth;
    const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");

    if (isAdminRoute && !isLoggedIn) {
        return Response.redirect(new URL("/login", req.nextUrl));
    }

    // High-level role check (Permissions are better checked inside the Page)
    if (isAdminRoute && user?.role === 'user') {
        return Response.redirect(new URL("/unauthorized", req.nextUrl));
    }

    // Redirect authenticated users away from login page
    if (isAuthPage) {
        if (isAuth) {
            return NextResponse.redirect(new URL('/dashboard', req.url))
        }
        return response;
        
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

    return response;
})



export const config = {
    matcher: [
        // '/dashboard/:path*',
        // '/profile/:path*',
        // '/admin/:path*',
    ]
}