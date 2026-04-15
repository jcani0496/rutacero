import { type NextRequest } from 'next/server';
import { updateSession } from './src/lib/supabase/middleware';

export function middleware(request: NextRequest) {
    return updateSession(request);
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
