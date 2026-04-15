import { NextResponse } from 'next/server';

export function middleware() {
    return NextResponse.next();
}

// NOTE: Next.js requires `config` to be statically analyzable. Do not re-export it.
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public assets
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
