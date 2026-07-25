import { NextResponse, type NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';

/**
 * Per-request Content-Security-Policy with a fresh nonce + 'strict-dynamic'.
 *
 * Why a proxy and not next.config.ts static headers?
 *   Static headers (Next's `headers()` config) cannot generate per-request
 *   nonces. To use nonces — the only way to drop `'unsafe-inline'` from
 *   `script-src` without breaking Next's own hydration scripts — the CSP
 *   must be set per request. Proxy runs on every dynamic request in Edge
 *   runtime, which is exactly the right hook.
 *
 * How Next.js picks up the nonce:
 *   When the CSP response header contains `'nonce-<value>'`, Next.js extracts
 *   that nonce and automatically attaches it to its own framework + page
 *   bundle <script> tags during SSR. Server Components can read the same
 *   nonce via `headers().get('x-nonce')` to pass into any third-party
 *   <Script> they render. (RutaCero currently renders zero third-party
 *   <script> tags, so the auto-injection alone is sufficient.)
 *
 * Rendering implications:
 *   Using nonces forces dynamic rendering for any page that needs them.
 *   RutaCero is already fully dynamic — every authenticated route runs a
 *   Supabase Server Component that reads cookies — so this is a no-op for
 *   us. If a fully static marketing page is later introduced, it must opt
 *   out of CSP (extend the matcher) or out of static rendering.
 */

/**
 * Build the CSP string for a given nonce + environment.
 *
 * Exported so it can be unit-tested without spinning up the Edge runtime.
 */
function buildCspHeader(nonce: string): string {
  const isProd = process.env.NODE_ENV === 'production';
  const isDev = process.env.NODE_ENV === 'development';

  // ---- connect-src ----------------------------------------------------------
  // Mirrors the previous logic from next.config.ts so XHR/fetch/websocket
  // destinations (Supabase + Sentry) stay allow-listed exactly as before.
  const connectSrc = new Set<string>([
    "'self'",
    'https://*.supabase.co',
    'https://*.supabase.in',
  ]);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const origin = new URL(supabaseUrl).origin;
      connectSrc.add(origin);
      // realtime websocket origin
      if (origin.startsWith('https://')) {
        connectSrc.add(origin.replace('https://', 'wss://'));
      } else if (origin.startsWith('http://')) {
        connectSrc.add(origin.replace('http://', 'ws://'));
      }
    } catch {
      // malformed URL — skip
    }
  }

  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (sentryDsn) {
    try {
      connectSrc.add(new URL(sentryDsn).origin);
    } catch {
      // malformed DSN — skip
    }
  }

  if (!isProd) {
    // Dev ergonomics: allow HTTP/WS to any host so a DHCP IP change or LAN
    // access (http://<lan-ip>:3000 ↔ supabase :54321) doesn't blank the page.
    connectSrc.add('http:');
    connectSrc.add('ws:');
    connectSrc.add('http://localhost:54321');
    connectSrc.add('http://127.0.0.1:54321');
    connectSrc.add('http://0.0.0.0:54321');
    connectSrc.add('ws://localhost:54321');
    connectSrc.add('ws://127.0.0.1:54321');
    connectSrc.add('ws://0.0.0.0:54321');
  }

  // ---- directives -----------------------------------------------------------
  // script-src: nonce + 'strict-dynamic'. 'strict-dynamic' lets scripts loaded
  //   via a nonced script load further scripts (e.g. Next's chunk loading)
  //   without each chunk needing its own allow-list entry. NO 'unsafe-inline',
  //   NO 'unsafe-eval' in production. Dev gets 'unsafe-eval' because React
  //   uses eval to reconstruct server-side error stacks in the browser.
  //
  // style-src: KEEPS 'unsafe-inline' deliberately. Radix UI, Recharts, and
  //   framer-motion all inject inline styles at runtime that we cannot nonce
  //   without forking those libraries. Style-based XSS is dramatically lower
  //   risk than script-based XSS (no JS execution, no data exfiltration via
  //   `fetch`), so this tradeoff is acceptable. The script-src hardening is
  //   the security win called out in the May-2026 audit.
  const scriptSrcExtras = isDev ? " 'unsafe-eval'" : '';

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${scriptSrcExtras}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://*.supabase.co https://*.supabase.in https://lh3.googleusercontent.com",
    "font-src 'self' data:",
    `connect-src ${Array.from(connectSrc).join(' ')}`,
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
  ];

  if (isProd) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    let appOrigin: string | null = null;
    if (appUrl) {
      try {
        appOrigin = new URL(appUrl).origin;
      } catch {
        appOrigin = null;
      }
    }
    const canUpgrade =
      (appOrigin?.startsWith('https://') ?? false) &&
      (supabaseUrl ? supabaseUrl.startsWith('https://') : true);
    if (canUpgrade) {
      directives.push('upgrade-insecure-requests');
    }
  }

  return directives.join('; ') + ';';
}

export async function proxy(request: NextRequest) {
  // crypto.randomUUID() is Edge-runtime compatible and gives 128 bits of
  // entropy — well above the "unguessable per-request" requirement. Base64
  // is just cosmetic (shorter header value than the UUID's dashes).
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = buildCspHeader(nonce);

  // Forward the nonce to Server Components via a request header. They read
  // it with `headers().get('x-nonce')` and pass it to any <Script>.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  // Session gate (Supabase or better-auth) + attribution + admin JWT.
  // Previously defined in updateSession but never wired — that was a gap.
  const response = await updateSession(request, { requestHeaders });
  response.headers.set('Content-Security-Policy', cspHeader);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (don't need CSP; setting one on JSON responses is wasted bytes)
     * - _next/static (build artifacts)
     * - _next/image (image optimizer)
     * - favicon.ico
     * - monitoring (Sentry tunnel route — must bypass auth/redirect logic)
     * - common static asset extensions
     *
     * Also skip Next.js link prefetches so they remain cacheable. Without
     * `missing`, every <Link> hover would generate a fresh dynamic page just
     * to compute a nonce that's then thrown away.
     */
    {
      source:
        '/((?!api|_next/static|_next/image|favicon.ico|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
