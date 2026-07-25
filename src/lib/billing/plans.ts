export type ProVariantCode =
    | 'PRO_MONTHLY'
    | 'PRO_QUARTERLY'
    | 'PRO_ANNUAL'
    | 'PRO_PASS_90D';

/** Commercial default for web checkout / pricing / paywall (mesa Fase A). */
export const DEFAULT_PRO_VARIANT_CODE: ProVariantCode = 'PRO_ANNUAL';

export interface ProVariant {
    code: ProVariantCode;
    label: string;
    priceQ: number;
    durationDays: number;
    /**
     * Billing months the price covers. Kept explicit instead of deriving
     * from durationDays: 365/30 = 12.17 "months" understated the annual
     * monthly-equivalent (Q32.79 advertised vs Q33.25 real — audit
     * 2026-07). Calendar plans bill per month/quarter/year, not per
     * 30-day block.
     */
    months: number;
    recurrenteInterval: 'monthly' | 'yearly' | null;
    isOneTime: boolean;
    headline: string;
}

const MONTHLY_PRICE_Q = 49;

/** Web checkout variants (excludes Android-only pass). */
export const WEB_PRO_VARIANT_CODES: readonly ProVariantCode[] = [
    'PRO_ANNUAL',
    'PRO_QUARTERLY',
    'PRO_MONTHLY',
] as const;

export const PRO_VARIANTS: readonly ProVariant[] = [
    {
        code: 'PRO_MONTHLY',
        label: 'PRO mensual',
        priceQ: MONTHLY_PRICE_Q,
        durationDays: 30,
        months: 1,
        recurrenteInterval: 'monthly',
        isOneTime: false,
        headline: 'Q49 al mes',
    },
    {
        code: 'PRO_QUARTERLY',
        label: 'PRO trimestral',
        priceQ: 119,
        durationDays: 90,
        months: 3,
        recurrenteInterval: null,
        isOneTime: true,
        headline: 'Q119 cada 3 meses (Q39.67/mes)',
    },
    {
        code: 'PRO_ANNUAL',
        label: 'PRO anual',
        priceQ: 399,
        durationDays: 365,
        months: 12,
        recurrenteInterval: 'yearly',
        isOneTime: false,
        headline: 'Q399 al año (Q33.25/mes)',
    },
    {
        code: 'PRO_PASS_90D',
        label: 'Pase Android 90 días',
        priceQ: 99,
        durationDays: 90,
        months: 3,
        recurrenteInterval: null,
        isOneTime: true,
        headline: 'Q99 por 90 días en Google Play',
    },
];

export function getProVariant(code: ProVariantCode): ProVariant {
    const found = PRO_VARIANTS.find((v) => v.code === code);
    if (!found) {
        const validCodes = PRO_VARIANTS.map((v) => v.code).join(', ');
        throw new Error(`Unknown PRO variant: "${code}". Valid codes: ${validCodes}`);
    }
    return found;
}

export function monthlyEquivalent(code: ProVariantCode): number {
    const v = getProVariant(code);
    return v.priceQ / v.months;
}

/**
 * Fraction saved vs paying month-to-month, computed from the actual
 * prices — never hardcoded. The old literals drifted (annual said 33%
 * when the real figure is 32%; the 90-day pass said 32% when it's 33%).
 */
export function discountVsMonthly(code: ProVariantCode): number {
    const equivalent = monthlyEquivalent(code);
    return Math.max(0, 1 - equivalent / MONTHLY_PRICE_Q);
}
