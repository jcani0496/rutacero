import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminSessionToken } from '@/lib/security/admin-session';
import {
    ATTRIBUTION_COOKIE_NAME,
    encodeAttributionCookie,
    extractTrackingOverrides,
    mergeAttributionState,
    parseAttributionCookie,
} from '@/lib/funnel/attribution';

const AUTH_COOKIE_NAME = 'rutacero-auth';

export async function updateSession(request: NextRequest) {
    // In local dev we intentionally allow NEXT_PUBLIC_SUPABASE_URL to be unset
    // (so the browser derives http://<hostname>:54321 and doesn't break with DHCP IP changes).
    // Middleware should still run, so we fall back to localhost for server-side calls.
    const supabaseUrl =
        process.env.SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        'http://127.0.0.1:54321';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseAnonKey) {
        // Skip auth/session handling if env vars are missing.
        return NextResponse.next({ request });
    }

    let supabaseResponse = NextResponse.next({ request });
    const attributionState = mergeAttributionState(
        parseAttributionCookie(request.cookies.get(ATTRIBUTION_COOKIE_NAME)?.value),
        extractTrackingOverrides(request.nextUrl.searchParams, request.nextUrl.pathname),
        () => crypto.randomUUID()
    );
    const encodedAttribution = encodeAttributionCookie(attributionState);
    request.cookies.set(ATTRIBUTION_COOKIE_NAME, encodedAttribution);
    supabaseResponse.cookies.set(ATTRIBUTION_COOKIE_NAME, encodedAttribution, {
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 90,
    });

    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookieOptions: { name: AUTH_COOKIE_NAME },
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    supabaseResponse.cookies.set(ATTRIBUTION_COOKIE_NAME, encodedAttribution, {
                        httpOnly: false,
                        sameSite: 'lax',
                        secure: process.env.NODE_ENV === 'production',
                        path: '/',
                        maxAge: 60 * 60 * 24 * 90,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh session if expired
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Protected routes - redirect to login if not authenticated
    const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
        request.nextUrl.pathname.startsWith('/signup');
    const isAppRoute = request.nextUrl.pathname.startsWith('/dashboard') ||
        request.nextUrl.pathname.startsWith('/debts') ||
        request.nextUrl.pathname.startsWith('/plan') ||
        request.nextUrl.pathname.startsWith('/forecast') ||
        request.nextUrl.pathname.startsWith('/finances') ||
        request.nextUrl.pathname.startsWith('/payments') ||
        request.nextUrl.pathname.startsWith('/settings') ||
        request.nextUrl.pathname.startsWith('/profile') ||
        request.nextUrl.pathname.startsWith('/help') ||
        request.nextUrl.pathname.startsWith('/workspaces');
    const isAdminLoginRoute = request.nextUrl.pathname === '/admin/login';
    const isAdminRoute = request.nextUrl.pathname.startsWith('/admin') && !isAdminLoginRoute;

    // Check for admin session via cookie (separate from Supabase auth)
    const adminSessionCookie = request.cookies.get('admin_session');
    const adminJwtSecret = process.env.ADMIN_JWT_SECRET;
    const adminSessionVerification = await verifyAdminSessionToken(
        adminSessionCookie?.value,
        adminJwtSecret
    );

    if (isAdminRoute && !adminSessionVerification.valid) {
        const url = request.nextUrl.clone();
        url.pathname = '/admin/login';
        const response = NextResponse.redirect(url);
        response.cookies.delete('admin_session');
        return response;
    }

    if (isAdminLoginRoute && adminSessionVerification.valid) {
        const url = request.nextUrl.clone();
        url.pathname = '/admin/dashboard';
        return NextResponse.redirect(url);
    }

    // Protect app routes with Supabase user
    if (!user && isAppRoute) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // Enforce progressive lockout even if credentials were obtained outside app UI.
    // This closes bypass attempts against direct Supabase auth endpoints.
    if (user?.email && isAppRoute) {
        try {
            // `auth_login_lockouts` is only readable by service_role and by the
            // authenticated owner row (policy added in migrations).
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: lockout } = await (supabase as any)
                .from('auth_login_lockouts')
                .select('locked_until')
                .eq('channel', 'user')
                .eq('principal', user.email.toLowerCase())
                .maybeSingle();

            const lockedUntil = lockout?.locked_until ? new Date(lockout.locked_until).getTime() : 0;
            if (lockedUntil > Date.now()) {
                await supabase.auth.signOut();
                const url = request.nextUrl.clone();
                url.pathname = '/login';
                url.searchParams.set('blocked', '1');
                return NextResponse.redirect(url);
            }
        } catch {
            // Fail open for availability. Lockout is defense-in-depth and already
            // enforced at login endpoint/server actions.
        }
    }

    // Redirect authenticated users away from auth routes
    if (user && isAuthRoute) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
    }

    // Update last_active_at periodically (throttled to reduce DB load)
    // Only track for app routes (not API, auth, or static assets)
    if (user && isAppRoute) {
        // 10% sampling - update on ~1 out of 10 requests
        const shouldUpdate = Math.random() < 0.1;

        if (shouldUpdate) {
            // Fire and forget - don't block the response.
            // Use the authenticated session client so we don't need service-role in middleware.
            const promiseLike = supabase
                .from('user_profiles')
                .update({ last_active_at: new Date().toISOString() })
                .eq('user_id', user.id);

            // Supabase query builders are "thenable" but don't always type `catch()`.
            void Promise.resolve(promiseLike).catch(() => undefined);
        }
    }

    return supabaseResponse;
}
