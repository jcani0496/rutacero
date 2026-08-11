import type { Currency } from '@/types';

/**
 * Single working-currency policy (RutaCero):
 * one currency per user = user_profiles.currency_base (GTQ | USD).
 * No FX / conversion — financial writes must use that currency.
 */

export type FinancialDataPresence = {
    debts: number;
    payments: number;
    incomes: number;
    expenses: number;
    budgets: number;
};

/** Spanish (tuteo): shown when currency change is blocked by existing records. */
export const WORKING_CURRENCY_LOCKED_MESSAGE =
    'No puedes cambiar tu moneda de trabajo porque ya tienes movimientos o registros financieros (deudas, pagos, ingresos, gastos o presupuestos). La moneda se elige en el onboarding y queda fija una vez hay datos. Si necesitás operar en otra moneda, usá una cuenta nueva sin registros previos.';

export const WORKING_CURRENCY_ADMIN_LOCKED_MESSAGE =
    'No se puede cambiar la moneda base de este usuario porque ya tiene movimientos o registros financieros (deudas, pagos, ingresos, gastos o presupuestos).';

export function normalizeWorkingCurrency(
    value: string | null | undefined,
): Currency {
    return value === 'USD' ? 'USD' : 'GTQ';
}

/**
 * Resolve the currency for a financial write.
 * Client-supplied currency is ignored; always use currency_base.
 */
export function resolveWorkingCurrencyForWrite(
    currencyBase: string | null | undefined,
    _clientCurrency?: string | null,
): Currency {
    return normalizeWorkingCurrency(currencyBase);
}

export function hasFinancialRecords(presence: FinancialDataPresence): boolean {
    return (
        presence.debts > 0 ||
        presence.payments > 0 ||
        presence.incomes > 0 ||
        presence.expenses > 0 ||
        presence.budgets > 0
    );
}

export function evaluateWorkingCurrencyChange(args: {
    current: Currency;
    next: string | null | undefined;
    presence: FinancialDataPresence;
    audience?: 'user' | 'admin';
}): { allowed: boolean; next: Currency; reason?: string } {
    const next = normalizeWorkingCurrency(args.next);
    if (args.current === next) {
        return { allowed: true, next };
    }
    if (!hasFinancialRecords(args.presence)) {
        return { allowed: true, next };
    }
    return {
        allowed: false,
        next,
        reason:
            args.audience === 'admin'
                ? WORKING_CURRENCY_ADMIN_LOCKED_MESSAGE
                : WORKING_CURRENCY_LOCKED_MESSAGE,
    };
}
