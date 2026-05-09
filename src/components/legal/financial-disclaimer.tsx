import { AlertCircle } from 'lucide-react';

interface FinancialDisclaimerProps {
    variant?: 'default' | 'compact';
    className?: string;
}

const DEFAULT_TEXT =
    'Esta es una herramienta de planificación informativa. No constituye asesoría financiera, contable ni legal. RutaCero no es entidad supervisada por la Superintendencia de Bancos de Guatemala.';

/**
 * Canonical, single-source disclaimer copy. Imported by email templates that
 * cannot use Tailwind classes and must render the text via React Email primitives.
 */
export const FINANCIAL_DISCLAIMER_TEXT = DEFAULT_TEXT;

export function FinancialDisclaimer({
    variant = 'default',
    className,
}: FinancialDisclaimerProps) {
    if (variant === 'compact') {
        return (
            <p
                className={`text-xs text-muted-foreground border-t border-border/40 pt-2 mt-4 ${className ?? ''}`.trim()}
                role="note"
            >
                {DEFAULT_TEXT}
            </p>
        );
    }

    return (
        <div
            className={`rounded-md border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex gap-2 ${className ?? ''}`.trim()}
            role="note"
        >
            <AlertCircle
                className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
            />
            <p>{DEFAULT_TEXT}</p>
        </div>
    );
}
