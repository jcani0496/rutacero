'use client';

import { useState } from 'react';
import {
    Calendar,
    ChevronDown,
    ChevronRight,
    Target,
    CreditCard,
    Info,
} from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { PlanItem } from '@/types';

interface PlanTimelineProps {
    items: PlanItem[];
    currency: string;
    focusDebtId?: string;
}

interface GroupedPeriod {
    periodStart: string;
    periodEnd: string;
    items: PlanItem[];
    totalPayment: number;
    focusDebt: PlanItem | null;
}

export function PlanTimeline({ items, currency, focusDebtId }: PlanTimelineProps) {
    const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set(['0']));

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-GT', {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-GT', {
            month: 'short',
            year: 'numeric',
        });
    };

    // Group items by period
    const periods: GroupedPeriod[] = [];
    const periodMap = new Map<string, PlanItem[]>();

    for (const item of items) {
        const key = `${item.period_start}-${item.period_end}`;
        if (!periodMap.has(key)) {
            periodMap.set(key, []);
        }
        periodMap.get(key)!.push(item);
    }

    periodMap.forEach((periodItems, key) => {
        const [start, end] = key.split('-');
        const totalPayment = periodItems.reduce((sum, item) => sum + Number(item.planned_amount), 0);
        const focusDebt = periodItems.find(item => item.debt_id === focusDebtId) ||
            periodItems.reduce((max, item) =>
                Number(item.planned_amount) > Number(max.planned_amount) ? item : max,
                periodItems[0]
            );

        periods.push({
            periodStart: start,
            periodEnd: end,
            items: periodItems,
            totalPayment,
            focusDebt,
        });
    });

    // Sort by period start date
    periods.sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime());

    const togglePeriod = (index: string) => {
        const newExpanded = new Set(expandedPeriods);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedPeriods(newExpanded);
    };

    if (periods.length === 0) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                    <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No hay períodos de pago en el plan</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Calendario de Pagos
                        </CardTitle>
                        <CardDescription>
                            {periods.length} períodos · Plan total: {formatCurrency(
                                periods.reduce((sum, p) => sum + p.totalPayment, 0)
                            )}
                        </CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (expandedPeriods.size === periods.length) {
                                setExpandedPeriods(new Set());
                            } else {
                                setExpandedPeriods(new Set(periods.map((_, i) => i.toString())));
                            }
                        }}
                    >
                        {expandedPeriods.size === periods.length ? 'Colapsar' : 'Expandir'} todo
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <TooltipProvider>
                    {periods.map((period, index) => {
                        const isExpanded = expandedPeriods.has(index.toString());
                        const isPast = new Date(period.periodEnd) < new Date();
                        const isCurrent = new Date(period.periodStart) <= new Date() &&
                            new Date(period.periodEnd) >= new Date();

                        return (
                            <Collapsible
                                key={index}
                                open={isExpanded}
                                onOpenChange={() => togglePeriod(index.toString())}
                            >
                                <div className={cn(
                                    'rounded-lg border transition-colors',
                                    isCurrent && 'border-primary bg-primary/5',
                                    isPast && 'opacity-60'
                                )}>
                                    <CollapsibleTrigger asChild>
                                        <button className="w-full p-4 flex items-center justify-between hover:bg-muted/50 rounded-lg transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold',
                                                    isCurrent
                                                        ? 'bg-primary text-primary-foreground'
                                                        : isPast
                                                            ? 'bg-muted text-muted-foreground'
                                                            : 'bg-muted/50 text-foreground'
                                                )}>
                                                    {index + 1}
                                                </div>
                                                <div className="text-left">
                                                    <p className="font-medium">
                                                        {formatDate(period.periodStart)}
                                                        {isCurrent && (
                                                            <Badge variant="default" className="ml-2 text-xs">
                                                                Actual
                                                            </Badge>
                                                        )}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {period.items.length} deuda{period.items.length !== 1 ? 's' : ''} ·
                                                        Foco: {period.focusDebt?.debt?.creditor || 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="font-bold text-lg">
                                                        {formatCurrency(period.totalPayment)}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        pago total
                                                    </p>
                                                </div>
                                                {isExpanded ? (
                                                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                                ) : (
                                                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                                )}
                                            </div>
                                        </button>
                                    </CollapsibleTrigger>

                                    <CollapsibleContent>
                                        <div className="px-4 pb-4 space-y-2 border-t pt-4">
                                            {period.items.map((item) => {
                                                const isFocus = item.debt_id === period.focusDebt?.debt_id;
                                                const minDueFromRationale = (() => {
                                                    const r = item.rationale as unknown;
                                                    if (!r || typeof r !== 'object') return null;
                                                    const v = (r as { min_due?: unknown }).min_due;
                                                    const n = Number(v);
                                                    return Number.isFinite(n) && n >= 0 ? n : null;
                                                })();
                                                const minDue = minDueFromRationale ?? Number(item.debt?.min_payment || 0);
                                                const isExtraPayment = Number(item.planned_amount) > minDue;

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={cn(
                                                            'flex items-center justify-between p-3 rounded-lg',
                                                            isFocus
                                                                ? 'bg-amber-500/10 border border-amber-500/30'
                                                                : 'bg-muted/30'
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                'p-2 rounded-lg',
                                                                isFocus ? 'bg-amber-500/20' : 'bg-muted'
                                                            )}>
                                                                {isFocus ? (
                                                                    <Target className="h-4 w-4 text-amber-500" />
                                                                ) : (
                                                                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-sm flex items-center gap-2">
                                                                    {item.debt?.creditor || `Deuda ${item.debt_id.slice(0, 8)}`}
                                                                    {isFocus && (
                                                                        <Badge variant="outline" className="text-amber-600 border-amber-500/50 text-xs">
                                                                            Foco
                                                                        </Badge>
                                                                    )}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Mín: {formatCurrency(minDue)}
                                                                    {isExtraPayment && (
                                                                        <span className="text-emerald-500 ml-2">
                                                                            +{formatCurrency(Number(item.planned_amount) - minDue)} extra
                                                                        </span>
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-right">
                                                                <p className={cn(
                                                                    'font-bold',
                                                                    isFocus ? 'text-amber-600' : ''
                                                                )}>
                                                                    {formatCurrency(Number(item.planned_amount))}
                                                                </p>
                                                            </div>
                                                            {item.rationale && (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                            <Info className="h-4 w-4" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="left" className="max-w-xs">
                                                                        <p className="font-medium mb-1">¿Por qué esta prioridad?</p>
                                                                        <p className="text-xs">
                                                                            {typeof item.rationale === 'string'
                                                                                ? item.rationale
                                                                                : (item.rationale as { summary?: string })?.summary || 'Sin detalles'}
                                                                        </p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </CollapsibleContent>
                                </div>
                            </Collapsible>
                        );
                    })}
                </TooltipProvider>
            </CardContent>
        </Card>
    );
}
