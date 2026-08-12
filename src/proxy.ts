import { type NextRequest } from 'next/server';

import { updateSession } from '@/lib/auth/session-gate';

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
 *   <Script> they render.
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
  const connectSrc = new Set<string>(["'self'"]);

  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (sentryDsn) {
    try {
      connectSrc.add(new URL(sentryDsn).origin);
    } catch {
      // malformed DSN — skip
    }
  }

  if (!isProd) {
    // Dev ergonomics: allow HTTP/WS to any host for LAN access.
    connectSrc.add('http:');
    connectSrc.add('ws:');
  }

  const scriptSrcExtras = isDev ? " 'unsafe-eval'" : '';

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${scriptSrcExtras}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://lh3.googleusercontent.com",
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
    if (appOrigin?.startsWith('https://')) {
      directives.push('upgrade-insecure-requests');
    }
  }

  return directives.join('; ') + ';';
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = buildCspHeader(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  // Session gate (better-auth) + attribution + admin JWT.
  const response = await updateSession(request, { requestHeaders });
  response.headers.set('Content-Security-Policy', cspHeader);

  return response;
}

export const config = {
  matcher: [
    {
      // Exclude Serwist SW route + static assets so CSP nonce rewriting never
      // wraps the service worker script response.
      source:
        '/((?!api|_next/static|_next/image|favicon.ico|monitoring|serwist|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
