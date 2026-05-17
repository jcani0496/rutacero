/**
 * Quetzal currency mark — a bold "Q" rendered in the brand surface color.
 *
 * Design history:
 *   - v1 (council v2): Lucide Rocket icon. Cliché Vercel/Linear CTA.
 *   - v2 (this file, first version): Q + horizontal slash UNDERNEATH.
 *     Too subtle — Growth said "could be Quora/Quizlet", María said
 *     "logo random".
 *   - v3 (this file, current version): just the bold Q.
 *     Earlier attempt tried a slash THROUGH the body of the Q, but both
 *     the glyph and the slash render in `currentColor` so they blend and
 *     the slash disappears visually. Trying to hardcode a contrasting
 *     color for the slash would break currentColor inheritance (the
 *     component is used in light and dark contexts).
 *
 * The clean Q reads unambiguously as a Q and gets its "this is money in
 * quetzales" semantics from the surrounding copy ("Q49/mes", "PRO se
 * cobra en quetzales", etc.).
 */
export function QuetzalMark({
    className = '',
}: {
    className?: string;
}) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            role="img"
            aria-label="Quetzal (GTQ)"
        >
            <text
                x="12"
                y="13"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="20"
                fontWeight={800}
                fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                fill="currentColor"
                style={{ letterSpacing: '-0.03em' }}
            >
                Q
            </text>
        </svg>
    );
}
