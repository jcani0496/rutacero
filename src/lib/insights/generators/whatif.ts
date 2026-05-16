/**
 * What-if insights — deterministic deltas showing the impact of adding extra
 * payment to the most expensive debt. Phrased as "a possibility you could
 * explore", never as a recommendation.
 */

import type { GeneratorContext, Insight } from '../types';
import { formatCurrency, formatMonths } from '../formatters';
import { mostExpensiveDebt, whatIfExtraPayment } from '../math';

/** Fixed extra-payment amount used by the MVP what-if scenario, in GTQ. */
export const WHATIF_EXTRA_PAYMENT = 500;

export function generateWhatIfInsights(ctx: GeneratorContext): Insight[] {
    const { debts, computedAt } = ctx;
    if (debts.length === 0) return [];

    const out: Insight[] = [];

    const expensive = mostExpensiveDebt(debts);
    if (!expensive || expensive.minPayment <= 0) return out;

    const delta = whatIfExtraPayment(
        expensive.balance,
        expensive.apr,
        expensive.minPayment,
        WHATIF_EXTRA_PAYMENT,
    );
    if (!delta) return out;
    if (delta.monthsSaved <= 0 && delta.interestSaved <= 0) return out;

    const monthsText =
        delta.monthsSaved > 0
            ? `reduciría aproximadamente ${formatMonths(delta.monthsSaved)} el tiempo total de pago`
            : 'no cambiaría significativamente el tiempo total de pago';
    const savingsText =
        delta.interestSaved > 0
            ? `ahorraría aproximadamente ${formatCurrency(delta.interestSaved, expensive.currency)} en intereses`
            : null;

    const tail = savingsText ? `${monthsText} y ${savingsText}.` : `${monthsText}.`;

    out.push({
        id: 'whatif-extra-500',
        category: 'whatif',
        severity: 'positive',
        title: `Escenario: ${formatCurrency(WHATIF_EXTRA_PAYMENT, expensive.currency)} extra al mes`,
        body: `Una opción que podrías explorar: agregar ${formatCurrency(WHATIF_EXTRA_PAYMENT, expensive.currency)} al pago mensual de tu deuda más cara (${expensive.creditor}) ${tail}`,
        cta: { label: 'Simular', href: '/forecast' },
        computedAt,
    });

    return out;
}
