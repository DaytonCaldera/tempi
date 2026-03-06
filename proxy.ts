import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { ROLES } from "./lib/constants"

export default withAuth(
    function proxy(req) {
        const token = req.nextauth.token
        const isAuth = !!token
        const isAuthPage = req.nextUrl.pathname.startsWith('/login')
        const path = req.nextUrl.pathname;
        
        // Admin only routes
        if (path.startsWith('/admin') && token?.role !== ROLES.SUPERADMIN) {
            return NextResponse.redirect(new URL('/unauthorized', req.url))
        }

        // Custom logic for different path patterns
        if (path.startsWith('/dashboard')) {
            // Dashboard specific checks
            if (token?.role === 'pending_user') {
                return NextResponse.redirect(new URL('/unauthorized', req.url))
            }
        }

        if (isAuthPage) {
            if (isAuth) {
                return NextResponse.redirect(new URL('/dashboard', req.url))
            }
            return null
        }

        if (!isAuth) {
            let from = req.nextUrl.pathname
            if (req.nextUrl.search) {
                from += req.nextUrl.search
            }

            return NextResponse.redirect(
                new URL(`/auth/login?from=${encodeURIComponent(from)}`, req.url)
            )
        }
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token
        },
    }
)

export const config = {
    matcher: [
        // '/',
        '/dashboard/:path*',
        '/profile/:path*',
        '/admin/:path*',
    ]
}