import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FinancialDisclaimer } from '@/components/legal/financial-disclaimer';
import { cn } from '@/lib/utils';
import type { Insight, InsightCategory, InsightSeverity } from '@/lib/insights';

interface InsightsSectionProps {
    insights: Insight[];
}

const CATEGORY_LABEL: Record<InsightCategory, string> = {
    cost: 'Costo',
    composition: 'Composición',
    calendar: 'Calendario',
    whatif: 'Escenario',
};

const SEVERITY_BADGE: Record<InsightSeverity, string> = {
    info: 'border-border bg-secondary text-muted-foreground',
    positive: 'border-primary/20 bg-accent text-[var(--rc-teal-text)]',
    attention: 'border-warning/30 bg-warning/10 text-warning',
};

const SEVERITY_LABEL: Record<InsightSeverity, string> = {
    info: 'Observación',
    positive: 'Oportunidad',
    attention: 'Atención',
};

function InsightCard({ insight }: { insight: Insight }) {
    return (
        <Card className="gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABEL[insight.category]}
                </p>
                <span
                    className={cn(
                        'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                        SEVERITY_BADGE[insight.severity],
                    )}
                >
                    {SEVERITY_LABEL[insight.severity]}
                </span>
            </div>
            <div className="space-y-1">
                <h3 className="text-base font-semibold leading-tight text-foreground">
                    {insight.title}
                </h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
                {insight.body}
            </p>
            {insight.cta ? (
                <div className="pt-1">
                    <Link
                        href={insight.cta.href}
                        className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        {insight.cta.label}
                        <span aria-hidden="true">→</span>
                    </Link>
                </div>
            ) : null}
        </Card>
    );
}

export function InsightsSection({ insights }: InsightsSectionProps) {
    if (!insights || insights.length === 0) return null;

    return (
        <section aria-labelledby="insights-heading" className="space-y-3">
            <Card className="gap-4">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                    <div>
                        <CardTitle id="insights-heading" className="text-lg">
                            Análisis automático
                        </CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Observaciones calculadas a partir de tus deudas activas.
                        </p>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {insights.map((insight) => (
                            <InsightCard key={insight.id} insight={insight} />
                        ))}
                    </div>
                    <FinancialDisclaimer variant="compact" />
                </CardContent>
            </Card>
        </section>
    );
}
