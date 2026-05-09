export type ProVariantCode =
    | 'PRO_MONTHLY'
    | 'PRO_QUARTERLY'
    | 'PRO_ANNUAL'
    | 'PRO_PASS_90D';

export interface ProVariant {
    code: ProVariantCode;
    label: string;
    priceQ: number;
    durationDays: number;
    recurrenteInterval: 'monthly' | 'yearly' | null;
    isOneTime: boolean;
    headline: string;
    discountVsMonthly: number;
}

export const PRO_VARIANTS: readonly ProVariant[] = [
    {
        code: 'PRO_MONTHLY',
        label: 'PRO mensual',
        priceQ: 49,
        durationDays: 30,
        recurrenteInterval: 'monthly',
        isOneTime: false,
        headline: 'Q49 al mes',
        discountVsMonthly: 0,
    },
    {
        code: 'PRO_QUARTERLY',
        label: 'PRO trimestral',
        priceQ: 119,
        durationDays: 90,
        recurrenteInterval: null,
        isOneTime: true,
        headline: 'Q119 cada 3 meses (Q39.67/mes)',
        discountVsMonthly: 0.19,
    },
    {
        code: 'PRO_ANNUAL',
        label: 'PRO anual',
        priceQ: 399,
        durationDays: 365,
        recurrenteInterval: 'yearly',
        isOneTime: false,
        headline: 'Q399 al año (Q32.79/mes)',
        discountVsMonthly: 0.32,
    },
    {
        code: 'PRO_PASS_90D',
        label: 'Pase Android 90 días',
        priceQ: 99,
        durationDays: 90,
        recurrenteInterval: null,
        isOneTime: true,
        headline: 'Q99 por 90 días en Google Play',
        discountVsMonthly: 0.32,
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
    const months = v.durationDays / 30;
    return v.priceQ / months;
}
