/**
 * Composition insights — neutral facts about the size and shape of the user's
 * debt portfolio.
 */

import type { GeneratorContext, Insight } from '../types';
import { formatCurrency, formatMonths } from '../formatters';
import { payoffMonths, smallestDebt, totalBalance } from '../math';

export function generateCompositionInsights(ctx: GeneratorContext): Insight[] {
    const { debts, computedAt } = ctx;
    if (debts.length === 0) return [];

    const out: Insight[] = [];

    const total = totalBalance(debts);
    const currency = debts[0]?.currency ?? 'GTQ';

    out.push({
        id: 'composition-total-debts',
        category: 'composition',
        severity: 'info',
        title: 'Resumen de tus deudas',
        body: `Tenés ${debts.length} deuda${debts.length === 1 ? '' : 's'} activa${debts.length === 1 ? '' : 's'} por un total aproximado de ${formatCurrency(total, currency)}.`,
        cta: { label: 'Ver deudas', href: '/debts' },
        computedAt,
    });

    const smallest = smallestDebt(debts);
    if (smallest && smallest.minPayment > 0) {
        const months = payoffMonths(
            smallest.balance,
            smallest.apr,
            smallest.minPayment,
        );
        if (months !== null) {
            out.push({
                id: 'composition-smallest-debt',
                category: 'composition',
                severity: 'positive',
                title: 'Tu deuda más pequeña',
                body: `Tu deuda más pequeña según tus datos es ${smallest.creditor} por ${formatCurrency(smallest.balance, smallest.currency)}. Al ritmo actual del pago mínimo se cerraría en aproximadamente ${formatMonths(months)}.`,
                computedAt,
            });
        }
    }

    return out;
}
