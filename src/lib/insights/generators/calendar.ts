/**
 * Calendar insights — observations about upcoming scheduled payments.
 */

import type { GeneratorContext, Insight } from '../types';
import { formatCurrency, formatLongDate } from '../formatters';
import { debtsDueWithin, nextUpcomingPayment } from '../math';

export function generateCalendarInsights(ctx: GeneratorContext): Insight[] {
    const { debts, computedAt } = ctx;
    if (debts.length === 0) return [];

    const out: Insight[] = [];
    const currency = debts[0]?.currency ?? 'GTQ';

    const next = nextUpcomingPayment(debts, computedAt);
    if (next && next.minPayment > 0) {
        out.push({
            id: 'calendar-next-payment',
            category: 'calendar',
            severity: 'info',
            title: 'Próximo pago programado',
            body: `Según tus datos, tu próximo pago programado es el ${formatLongDate(next.nextPaymentDate)} por aproximadamente ${formatCurrency(next.minPayment, next.currency)} a ${next.creditor}.`,
            cta: { label: 'Ver agenda', href: '/agenda' },
            computedAt,
        });
    }

    const upcoming = debtsDueWithin(debts, computedAt, 7);
    if (upcoming.length > 0) {
        const total = upcoming.reduce((acc, d) => acc + (d.minPayment || 0), 0);
        if (total > 0) {
            out.push({
                id: 'calendar-week-upcoming',
                category: 'calendar',
                severity: upcoming.length >= 3 ? 'attention' : 'info',
                title: 'Pagos en los próximos 7 días',
                body: `En los próximos 7 días tenés ${upcoming.length} pago${upcoming.length === 1 ? '' : 's'} programado${upcoming.length === 1 ? '' : 's'} por un total aproximado de ${formatCurrency(total, currency)}.`,
                computedAt,
            });
        }
    }

    return out;
}
