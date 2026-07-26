import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isProd = process.env.NODE_ENV === "production";

// NOTE: Content-Security-Policy is now built per-request in `src/proxy.ts` so
// each response carries a fresh nonce + 'strict-dynamic' (no 'unsafe-inline'
// for scripts). The old static CSP that lived here was removed in the
// security/csp-nonce-strict-dynamic branch — see proxy.ts for the new policy.
// All other security headers below remain static because they have no
// per-request component.

const nextConfig: NextConfig = {
  // PERF-010: Enable gzip compression for responses
  compress: true,
  allowedDevOrigins: isProd ? undefined : ['127.0.0.1', 'localhost', '10.0.2.2'],
  experimental: {
    optimizePackageImports: [
      'recharts',
      'date-fns',
      'framer-motion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select'
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ]
  }
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // NOTE: deprecated Sentry options (`disableLogger`, etc.) omitted —
  // they were no-ops under Turbopack (Next 16) and only emitted warnings.
  // NOTE: `tunnelRoute` was set to "/monitoring" to bypass ad-blockers, but
  // @sentry/nextjs creates the tunnel via a webpack rewrite that Turbopack
  // (Next 16's default builder) does NOT process — the route returns 404 and
  // every browser-side event fails silently. Verified via direct envelope
  // POST to ingest.us.sentry.io (HTTP 200) vs the same envelope through the
  // tunnel (HTTP 404). Until @sentry/nextjs supports Turbopack tunneling,
  // we ship without tunnel. Cost: users with aggressive ad-blockers
  // (uBlock, Brave shields) lose Sentry events. Tradeoff acceptable for v1.
});
