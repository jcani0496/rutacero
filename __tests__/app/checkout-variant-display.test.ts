import { describe, it, expect } from 'vitest';
import { DEFAULT_PRO_VARIANT_CODE } from '@/lib/billing/plans';
import { resolveVariantCode } from '@/lib/billing/resolve';

describe('resolveVariantCode', () => {
    it('returns PRO_ANNUAL for null', () => {
        expect(resolveVariantCode(null)).toBe('PRO_ANNUAL');
    });

    it('returns PRO_ANNUAL for undefined', () => {
        expect(resolveVariantCode(undefined)).toBe('PRO_ANNUAL');
    });

    it('returns PRO_ANNUAL for empty string', () => {
        expect(resolveVariantCode('')).toBe('PRO_ANNUAL');
    });

    it('returns PRO_ANNUAL for unknown values', () => {
        expect(resolveVariantCode('PRO_FOO')).toBe('PRO_ANNUAL');
        expect(resolveVariantCode('foo')).toBe('PRO_ANNUAL');
        expect(resolveVariantCode(42)).toBe('PRO_ANNUAL');
        expect(resolveVariantCode({})).toBe('PRO_ANNUAL');
    });

    it('returns PRO_MONTHLY for valid monthly input', () => {
        expect(resolveVariantCode('PRO_MONTHLY')).toBe('PRO_MONTHLY');
    });

    it('returns PRO_QUARTERLY for valid quarterly input', () => {
        expect(resolveVariantCode('PRO_QUARTERLY')).toBe('PRO_QUARTERLY');
    });

    it('returns PRO_ANNUAL for valid annual input', () => {
        expect(resolveVariantCode('PRO_ANNUAL')).toBe('PRO_ANNUAL');
    });

    it('returns PRO_PASS_90D for valid pass input', () => {
        expect(resolveVariantCode('PRO_PASS_90D')).toBe('PRO_PASS_90D');
    });

    it('uses DEFAULT_PRO_VARIANT_CODE as the fallback', () => {
        expect(DEFAULT_PRO_VARIANT_CODE).toBe('PRO_ANNUAL');
        expect(resolveVariantCode(null)).toBe(DEFAULT_PRO_VARIANT_CODE);
    });
});
