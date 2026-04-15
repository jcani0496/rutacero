'use client';

import {
    Lightbulb,
    TrendingUp,
    TrendingDown,
    Minus,
    ChevronDown,
} from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface RationaleFactor {
    name: string;
    value: string;
    weight: number;
    impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    explanation: string;
}

interface RationaleBreakdown {
    factors: RationaleFactor[];
    summary: string;
}

interface RationaleCardProps {
    creditor: string;
    rationale: RationaleBreakdown;
    priorityOrder: number;
    currency?: string;
}

export function RationaleCard({
    creditor,
    rationale,
    priorityOrder,
}: RationaleCardProps) {
    const getImpactIcon = (impact: RationaleFactor['impact']) => {
        switch (impact) {
            case 'POSITIVE':
                return <TrendingUp className="h-4 w-4 text-emerald-500" />;
            case 'NEGATIVE':
                return <TrendingDown className="h-4 w-4 text-red-500" />;
            default:
                return <Minus className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const getImpactColor = (impact: RationaleFactor['impact']) => {
        switch (impact) {
            case 'POSITIVE':
                return 'text-emerald-600 dark:text-emerald-400';
            case 'NEGATIVE':
                return 'text-red-600 dark:text-red-400';
            default:
                return 'text-muted-foreground';
        }
    };

    return (
        <Card className="overflow-hidden">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-full font-bold text-sm',
                            priorityOrder === 1
                                ? 'bg-amber-500 text-white'
                                : 'bg-muted text-muted-foreground'
                        )}>
                            #{priorityOrder}
                        </div>
                        <div>
                            <CardTitle className="text-base">{creditor}</CardTitle>
                            {priorityOrder === 1 && (
                                <Badge variant="outline" className="mt-1 text-amber-600 border-amber-500/50">
                                    Deuda Foco
                                </Badge>
                            )}
                        </div>
                    </div>
                    <Lightbulb className="h-5 w-5 text-amber-500" />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Summary */}
                <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-sm">{rationale.summary}</p>
                </div>

                {/* Factors Breakdown */}
                <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                        <ChevronDown className="h-4 w-4" />
                        Ver factores de análisis
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3 space-y-3">
                        {rationale.factors.map((factor, index) => (
                            <div key={index} className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {getImpactIcon(factor.impact)}
                                        <span className="text-sm font-medium">{factor.name}</span>
                                    </div>
                                    <Badge variant="secondary" className="text-xs">
                                        {factor.value}
                                    </Badge>
                                </div>
                                <Progress
                                    value={factor.weight * 100}
                                    className="h-1.5"
                                />
                                <p className={cn(
                                    'text-xs',
                                    getImpactColor(factor.impact)
                                )}>
                                    {factor.explanation}
                                </p>
                            </div>
                        ))}
                    </CollapsibleContent>
                </Collapsible>
            </CardContent>
        </Card>
    );
}

interface RationaleListProps {
    debts: Array<{
        id: string;
        creditor: string;
        priorityOrder: number;
        rationale?: RationaleBreakdown;
    }>;
}

export function RationaleList({ debts }: RationaleListProps) {
    if (!debts.length) return null;

    // Sort by priority order
    const sortedDebts = [...debts].sort((a, b) => a.priorityOrder - b.priorityOrder);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    ¿Por qué este orden?
                </CardTitle>
                <CardDescription>
                    Análisis detallado de la priorización de tus deudas
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {sortedDebts.slice(0, 3).map((debt) => (
                    debt.rationale && (
                        <RationaleCard
                            key={debt.id}
                            creditor={debt.creditor}
                            rationale={debt.rationale}
                            priorityOrder={debt.priorityOrder}
                        />
                    )
                ))}
                {sortedDebts.length > 3 && (
                    <p className="text-center text-sm text-muted-foreground">
                        +{sortedDebts.length - 3} deudas más en el plan
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
