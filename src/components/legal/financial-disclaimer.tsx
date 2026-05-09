import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
            <aside
                aria-label="Aviso legal"
                className={cn(
                    'text-xs text-muted-foreground border-t border-border/40 pt-2 mt-4',
                    className,
                )}
            >
                <p>{DEFAULT_TEXT}</p>
            </aside>
        );
    }

    return (
        <aside
            aria-label="Aviso legal"
            className={cn(
                'rounded-md border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex gap-2',
                className,
            )}
        >
            <AlertCircle
                className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
            />
            <p>{DEFAULT_TEXT}</p>
        </aside>
    );
}
