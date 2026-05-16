import Link from 'next/link';
import { Calendar, Coins, PieChart, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FinancialDisclaimer } from '@/components/legal/financial-disclaimer';
import { cn } from '@/lib/utils';
import type { Insight, InsightCategory, InsightSeverity } from '@/lib/insights';

interface InsightsSectionProps {
    insights: Insight[];
}

const CATEGORY_ICON: Record<InsightCategory, typeof Coins> = {
    cost: Coins,
    composition: PieChart,
    calendar: Calendar,
    whatif: Sparkles,
};

const CATEGORY_LABEL: Record<InsightCategory, string> = {
    cost: 'Costo',
    composition: 'Composición',
    calendar: 'Calendario',
    whatif: 'Escenario',
};

// info=blue, positive=emerald, attention=amber (NOT red — these are
// observations, not warnings).
const SEVERITY_BADGE: Record<InsightSeverity, string> = {
    info: 'border-blue-500/30 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    positive:
        'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    attention:
        'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
};

const SEVERITY_ICON_BG: Record<InsightSeverity, string> = {
    info: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
    positive: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    attention: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
};

const SEVERITY_LABEL: Record<InsightSeverity, string> = {
    info: 'Observación',
    positive: 'Oportunidad',
    attention: 'Atención',
};

function InsightCard({ insight }: { insight: Insight }) {
    const Icon = CATEGORY_ICON[insight.category];
    return (
        <Card className="gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
                <div
                    className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-xl',
                        SEVERITY_ICON_BG[insight.severity],
                    )}
                    aria-hidden="true"
                >
                    <Icon className="h-4 w-4" />
                </div>
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
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABEL[insight.category]}
                </p>
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
                        <CardTitle
                            id="insights-heading"
                            className="flex items-center gap-2 text-lg"
                        >
                            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
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
