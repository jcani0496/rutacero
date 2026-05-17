/**
 * Quetzal currency mark — a stylized "Q" with a small horizontal stroke
 * underneath, evoking the GTQ currency symbol. Used in marketing surfaces
 * where the brand wants to signal "money in quetzales" without resorting
 * to a generic dollar/euro icon.
 */
export function QuetzalMark({
    className = '',
    strokeWidth = 1.8,
}: {
    className?: string;
    strokeWidth?: number;
}) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            role="img"
            aria-label="Quetzal"
        >
            {/* Outer circle of the Q */}
            <circle cx="11" cy="11" r="8" />
            {/* Tail stroke of the Q */}
            <path d="M16 16 L20 20" />
            {/* Currency horizontal slash underneath */}
            <path d="M8 21 L18 21" opacity="0.6" />
        </svg>
    );
}
