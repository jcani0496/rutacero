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
            bgClass: 'border-destructive/30 bg-destructive/5',
            iconClass: 'text-destructive',
        },
        WARNING: {
            variant: 'default' as const,
            icon: Warning,
            bgClass: 'border-warning/30 bg-warning/5',
            iconClass: 'text-warning',
        },
        INFO: {
            variant: 'default' as const,
            icon: Info,
            bgClass: 'border-border bg-secondary',
            iconClass: 'text-muted-foreground',
        },
        SUCCESS: {
            variant: 'default' as const,
            icon: CheckCircle,
            bgClass: 'border-primary/20 bg-accent',
            iconClass: 'text-[var(--rc-teal-text)]',
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
                criticalCount > 0 ? 'text-destructive' : 'text-warning'
            )} />
            <span className={cn(
                'absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-medium text-white',
                criticalCount > 0 ? 'bg-destructive' : 'bg-warning'
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
            color: 'text-[var(--rc-teal-text)]',
            bg: 'bg-accent',
            border: 'border-primary/20',
        },
        AT_RISK: {
            label: 'En Riesgo',
            color: 'text-warning',
            bg: 'bg-warning/10',
            border: 'border-warning/20',
        },
        CRITICAL: {
            label: 'Crítico',
            color: 'text-destructive',
            bg: 'bg-destructive/10',
            border: 'border-destructive/20',
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
