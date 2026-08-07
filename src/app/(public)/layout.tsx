/**
 * Force dynamic rendering for marketing/legal public routes.
 *
 * `src/proxy.ts` issues a fresh CSP nonce on every request. Statically
 * prerendered HTML would embed a stale nonce that never matches the
 * response header — browsers block hydration scripts and client UI
 * (CookieBanner, nav, etc.) never mounts. Reading nothing else: the
 * export alone opts the whole (public) group into per-request SSR.
 *
 * Root layout also calls `headers()` for the same reason app-wide;
 * this keeps the public group explicit if that ever changes.
 */
export const dynamic = 'force-dynamic';

export default function PublicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
