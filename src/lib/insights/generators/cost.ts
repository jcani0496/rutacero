/**
 * Cost insights — observations about how much interest the user is paying.
 * All copy is neutral (descriptive, not prescriptive).
 */

import type { GeneratorContext, Insight } from '../types';
import { formatCurrency, formatPercent } from '../formatters';
import {
    monthlyInterestFor,
    mostExpensiveDebt,
    totalMinPayments,
    totalMonthlyInterest,
} from '../math';

export function generateCostInsights(ctx: GeneratorContext): Insight[] {
    const { debts, computedAt } = ctx;
    if (debts.length === 0) return [];

    const out: Insight[] = [];

    const monthlyInterest = totalMonthlyInterest(debts);
    const minTotal = totalMinPayments(debts);
    // Use the dominant currency in the basket (fallback GTQ).
    const currency = debts[0]?.currency ?? 'GTQ';

    if (monthlyInterest > 0) {
        const percentOfPayments =
            minTotal > 0 ? (monthlyInterest / minTotal) * 100 : 0;

        const body =
            percentOfPayments > 0
                ? `Actualmente pagás aproximadamente ${formatCurrency(monthlyInterest, currency)} al mes solo en intereses, lo que representa cerca del ${formatPercent(percentOfPayments)} de tus pagos mínimos mensuales.`
                : `Actualmente pagás aproximadamente ${formatCurrency(monthlyInterest, currency)} al mes solo en intereses según tus datos.`;

        out.push({
            id: 'cost-monthly-interest',
            category: 'cost',
            severity: percentOfPayments >= 40 ? 'attention' : 'info',
            title: 'Interés mensual estimado',
            body,
            computedAt,
        });
    }

    const expensive = mostExpensiveDebt(debts);
    if (expensive) {
        const interest = monthlyInterestFor(expensive);
        if (interest > 0) {
            const apr = Number(expensive.apr ?? 0);
            out.push({
                id: 'cost-most-expensive-debt',
                category: 'cost',
                severity: 'info',
                title: 'Tu deuda más cara',
                body: `Tu deuda más cara según tus datos es ${expensive.creditor} a ${formatPercent(apr)} anual. Genera aproximadamente ${formatCurrency(interest, expensive.currency)} de interés mensual.`,
                cta: { label: 'Ver deudas', href: '/debts' },
                computedAt,
            });
        }
    }

    return out;
}
