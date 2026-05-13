import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isProd = process.env.NODE_ENV === "production";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseOrigin: string | null = null;
let appOrigin: string | null = null;

if (supabaseUrl) {
  try {
    supabaseOrigin = new URL(supabaseUrl).origin;
  } catch {
    supabaseOrigin = null;
  }
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL;
if (appUrl) {
  try {
    appOrigin = new URL(appUrl).origin;
  } catch {
    appOrigin = null;
  }
}

const toWsOrigin = (origin: string) => {
  if (origin.startsWith("https://")) return origin.replace("https://", "wss://");
  if (origin.startsWith("http://")) return origin.replace("http://", "ws://");
  return origin;
};

const connectSrc = new Set(["'self'", "https://*.supabase.co", "https://*.supabase.in"]);

if (supabaseOrigin) {
  connectSrc.add(supabaseOrigin);
  connectSrc.add(toWsOrigin(supabaseOrigin));
}

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  try {
    connectSrc.add(new URL(sentryDsn).origin);
  } catch {
    // malformed DSN; omit
  }
}

if (!isProd) {
  // Dev ergonomics: allow HTTP/WS to any host.
  // This avoids "blank screen" issues when your machine IP changes (DHCP) and
  // you access the app via `http://<lan-ip>:3000` while Supabase is on `:54321`.
  connectSrc.add("http:");
  connectSrc.add("ws:");

  connectSrc.add("http://localhost:54321");
  connectSrc.add("http://127.0.0.1:54321");
  connectSrc.add("http://0.0.0.0:54321");
  connectSrc.add("ws://localhost:54321");
  connectSrc.add("ws://127.0.0.1:54321");
  connectSrc.add("ws://0.0.0.0:54321");
}

const cspDirectives = [
  "default-src 'self';",
  // In dev, Next/React tooling may rely on eval. In prod, avoid it.
  `script-src 'self' ${isProd ? "" : "'unsafe-eval' "}'unsafe-inline'`.replace(/\s+/g, " ").trim() + ";",
  "style-src 'self' 'unsafe-inline';",
  "img-src 'self' blob: data: https://*.supabase.co https://*.supabase.in https://lh3.googleusercontent.com;",
  "font-src 'self' data:;",
  `connect-src ${Array.from(connectSrc).join(" ")};`,
  "frame-src 'self';",
  "object-src 'none';",
  "base-uri 'self';",
  "form-action 'self';",
  "frame-ancestors 'none';",
  "worker-src 'self' blob:;",
];

if (isProd) {
  // Only upgrade insecure requests if we're actually running behind HTTPS everywhere.
  // This prevents breaking local Supabase (http://...) when running `next start`.
  const canUpgrade =
    (appOrigin?.startsWith("https://") ?? false) &&
    (supabaseOrigin ? supabaseOrigin.startsWith("https://") : true);

  if (canUpgrade) {
    cspDirectives.push("upgrade-insecure-requests;");
  }
}

const cspHeader = cspDirectives.join(" ");

const nextConfig: NextConfig = {
  // PERF-010: Enable gzip compression for responses
  compress: true,
  allowedDevOrigins: isProd ? undefined : ['127.0.0.1', 'localhost', '10.0.2.2'],
  experimental: {
    optimizePackageImports: [
      'lucide-react',
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
            key: 'Content-Security-Policy',
            value: cspHeader
          },
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
  // NOTE: `disableLogger` and `automaticVercelMonitors` removed in this branch.
  // They were deprecated in @sentry/nextjs@10.x AND are no-ops under Turbopack
  // (Next 16's default builder). Their presence only emitted DEPRECATION
  // WARNINGs that polluted logs and added noise to CI output.
  // NOTE: `tunnelRoute` was set to "/monitoring" to bypass ad-blockers, but
  // @sentry/nextjs creates the tunnel via a webpack rewrite that Turbopack
  // (Next 16's default builder) does NOT process — the route returns 404 and
  // every browser-side event fails silently. Verified via direct envelope
  // POST to ingest.us.sentry.io (HTTP 200) vs the same envelope through the
  // tunnel (HTTP 404). Until @sentry/nextjs supports Turbopack tunneling,
  // we ship without tunnel. Cost: users with aggressive ad-blockers
  // (uBlock, Brave shields) lose Sentry events. Tradeoff acceptable for v1.
});
