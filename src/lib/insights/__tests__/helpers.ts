import type { DebtSnapshot } from '../types';

export function makeDebt(overrides: Partial<DebtSnapshot> = {}): DebtSnapshot {
    return {
        id: overrides.id ?? 'debt-1',
        creditor: overrides.creditor ?? 'BAC Tarjeta',
        balance: overrides.balance ?? 10000,
        apr: overrides.apr ?? 24,
        minPayment: overrides.minPayment ?? 500,
        paymentDay: overrides.paymentDay ?? 15,
        nextPaymentDate: overrides.nextPaymentDate ?? '2026-05-20',
        currency: overrides.currency ?? 'GTQ',
        type: overrides.type ?? 'TARJETA_CREDITO',
    };
}

export const NOW_ISO = '2026-05-15T12:00:00.000Z';
