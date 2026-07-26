'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    ArrowRight,
    Bell,
    CheckCircle,
    Info,
    Warning,
    XCircle
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Alert as AlertType } from '@/lib/alerts/summary';
import { useMemo, useState } from 'react';

interface AlertBannerProps {
    alerts: AlertType[];
    maxDisplay?: number;
}

export function AlertBanner({ alerts, maxDisplay = 2 }: AlertBannerProps) {
    const pathname = usePathname();
    const [showAll, setShowAll] = useState(false);
    const allowInlineExpand = pathname === '/forecast';
    const effectiveMax = showAll ? alerts.length : maxDisplay;
    const displayAlerts = useMemo(() => alerts.slice(0, effectiveMax), [alerts, effectiveMax]);

    if (alerts.length === 0) return null;

    return (
        <div className="space-y-3">
            {displayAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
            ))}

            {alerts.length > maxDisplay && (
                allowInlineExpand ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setShowAll((prev) => !prev)}
                    >
                        {showAll ? 'Ver menos alertas' : `Ver ${alerts.length - maxDisplay} alertas más`}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                ) : (
                    <Button variant="ghost" size="sm" className="w-full" asChild>
                        <Link href="/forecast">
                            Ver {alerts.length - maxDisplay} alertas más
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                )
            )}
        </div>
    );
}

function AlertCard({ alert }: { alert: AlertType }) {
    const severityConfig = {
        CRITICAL: {
            variant: 'destructive' as const,
            icon: XCircle,
            bgClass: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900',
            iconClass: 'text-red-500',
        },
        WARNING: {
            variant: 'default' as const,
            icon: Warning,
            bgClass: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900',
            iconClass: 'text-amber-500',
        },
        INFO: {
            variant: 'default' as const,
            icon: Info,
            bgClass: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900',
            iconClass: 'text-blue-500',
        },
        SUCCESS: {
            variant: 'default' as const,
            icon: CheckCircle,
            bgClass: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900',
            iconClass: 'text-emerald-500',
        },
    };

    const config = severityConfig[alert.severity];
    const Icon = config.icon;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-GT', {
            style: 'currency',
            currency: 'GTQ',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <div className={cn(
            'flex items-start gap-4 rounded-lg border p-4 transition-all',
            config.bgClass
        )}>
            <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', config.iconClass)} />
            <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm">{alert.title}</h4>
                <p className="text-sm text-muted-foreground">{alert.message}</p>
                {alert.amount && (
                    <p className="text-sm font-medium mt-1">
                        {formatCurrency(alert.amount)}
                    </p>
                )}
            </div>
            {alert.debtId && (
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/payments">
                        Pagar
                    </Link>
                </Button>
            )}
        </div>
    );
}

// Compact version for sidebar/header
interface AlertIndicatorProps {
    criticalCount: number;
    warningCount: number;
}

export function AlertIndicator({ criticalCount, warningCount }: AlertIndicatorProps) {
    const total = criticalCount + warningCount;

    if (total === 0) return null;

    return (
        <div className="relative">
            <Bell className={cn(
                'h-5 w-5',
                criticalCount > 0 ? 'text-red-500' : 'text-amber-500'
            )} />
            <span className={cn(
                'absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-medium text-white',
                criticalCount > 0 ? 'bg-red-500' : 'bg-amber-500'
            )}>
                {total > 9 ? '9+' : total}
            </span>
        </div>
    );
}

// Risk Score Badge
interface RiskScoreBadgeProps {
    score: number;
    level: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
    compact?: boolean;
}

export function RiskScoreBadge({ score, level, compact = false }: RiskScoreBadgeProps) {
    const levelConfig = {
        HEALTHY: {
            label: 'Saludable',
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20',
        },
        AT_RISK: {
            label: 'En Riesgo',
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/20',
        },
        CRITICAL: {
            label: 'Crítico',
            color: 'text-red-500',
            bg: 'bg-red-500/10',
            border: 'border-red-500/20',
        },
    };

    const config = levelConfig[level];

    if (compact) {
        return (
            <div className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1 border',
                config.bg,
                config.border
            )}>
                <span className={cn('text-lg font-bold', config.color)}>{score}</span>
                <span className="text-xs text-muted-foreground">/100</span>
            </div>
        );
    }

    return (
        <div className={cn(
            'rounded-xl border p-4',
            config.bg,
            config.border
        )}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-muted-foreground">Salud Financiera</p>
                    <p className={cn('text-lg font-semibold', config.color)}>
                        {config.label}
                    </p>
                </div>
                <div className="text-right">
                    <p className={cn('text-3xl font-bold', config.color)}>{score}</p>
                    <p className="text-xs text-muted-foreground">/100</p>
                </div>
            </div>
        </div>
    );
}
