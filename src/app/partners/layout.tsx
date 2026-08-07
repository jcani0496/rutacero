/**
 * Partners routes are statically eligible without this export; see
 * `(public)/layout.tsx` for why CSP nonces require dynamic rendering.
 */
export const dynamic = 'force-dynamic';

export default function PartnersLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
