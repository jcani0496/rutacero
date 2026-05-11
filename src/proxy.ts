import { NextResponse } from 'next/server';

export async function proxy() {
    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - monitoring (Sentry tunnel route — must bypass any auth/redirect logic)
         * - public assets
         */
        '/((?!_next/static|_next/image|favicon.ico|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
