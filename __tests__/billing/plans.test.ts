import { describe, it, expect } from 'vitest';
import { PRO_VARIANTS, getProVariant, monthlyEquivalent } from '@/lib/billing/plans';

describe('PRO_VARIANTS', () => {
    it('exposes 4 variants with stable codes', () => {
        const codes = PRO_VARIANTS.map((v) => v.code).sort();
        expect(codes).toEqual(['PRO_ANNUAL', 'PRO_MONTHLY', 'PRO_PASS_90D', 'PRO_QUARTERLY']);
    });

    it('annual is cheaper per month than monthly', () => {
        expect(monthlyEquivalent('PRO_ANNUAL')).toBeLessThan(monthlyEquivalent('PRO_MONTHLY'));
    });

    it('quarterly is cheaper per month than monthly', () => {
        expect(monthlyEquivalent('PRO_QUARTERLY')).toBeLessThan(monthlyEquivalent('PRO_MONTHLY'));
    });

    it('PRO_PASS_90D is one-time and Android-only (no recurrenteInterval)', () => {
        const v = getProVariant('PRO_PASS_90D');
        expect(v.isOneTime).toBe(true);
        expect(v.recurrenteInterval).toBeNull();
    });

    it('PRO_QUARTERLY is one-time (Recurrente client only supports monthly|yearly)', () => {
        const v = getProVariant('PRO_QUARTERLY');
        expect(v.isOneTime).toBe(true);
        expect(v.recurrenteInterval).toBeNull();
    });

    it('PRO_MONTHLY and PRO_ANNUAL are recurring with matching Recurrente interval', () => {
        expect(getProVariant('PRO_MONTHLY').recurrenteInterval).toBe('monthly');
        expect(getProVariant('PRO_ANNUAL').recurrenteInterval).toBe('yearly');
        expect(getProVariant('PRO_MONTHLY').isOneTime).toBe(false);
        expect(getProVariant('PRO_ANNUAL').isOneTime).toBe(false);
    });

    it('throws on unknown variant', () => {
        expect(() => getProVariant('UNKNOWN' as unknown as 'PRO_MONTHLY')).toThrow();
    });

    it('discountVsMonthly is between 0 and 1 (exclusive of 1)', () => {
        for (const v of PRO_VARIANTS) {
            expect(v.discountVsMonthly).toBeGreaterThanOrEqual(0);
            expect(v.discountVsMonthly).toBeLessThan(1);
        }
    });

    it('priceQ and durationDays are positive', () => {
        for (const v of PRO_VARIANTS) {
            expect(v.priceQ).toBeGreaterThan(0);
            expect(v.durationDays).toBeGreaterThan(0);
        }
    });

    it('monthlyEquivalent returns expected values per variant', () => {
        expect(monthlyEquivalent('PRO_MONTHLY')).toBeCloseTo(49, 2);
        expect(monthlyEquivalent('PRO_QUARTERLY')).toBeCloseTo(39.67, 1);
        expect(monthlyEquivalent('PRO_ANNUAL')).toBeCloseTo(32.79, 1);
        expect(monthlyEquivalent('PRO_PASS_90D')).toBeCloseTo(33, 2);
    });
});
