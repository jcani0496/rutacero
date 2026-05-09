import { describe, it, expect } from 'vitest';
import { resolveVariantCode } from '@/lib/billing/resolve';

describe('resolveVariantCode', () => {
    it('returns PRO_MONTHLY for null', () => {
        expect(resolveVariantCode(null)).toBe('PRO_MONTHLY');
    });

    it('returns PRO_MONTHLY for undefined', () => {
        expect(resolveVariantCode(undefined)).toBe('PRO_MONTHLY');
    });

    it('returns PRO_MONTHLY for empty string', () => {
        expect(resolveVariantCode('')).toBe('PRO_MONTHLY');
    });

    it('returns PRO_MONTHLY for unknown values', () => {
        expect(resolveVariantCode('PRO_FOO')).toBe('PRO_MONTHLY');
        expect(resolveVariantCode('foo')).toBe('PRO_MONTHLY');
        expect(resolveVariantCode(42)).toBe('PRO_MONTHLY');
        expect(resolveVariantCode({})).toBe('PRO_MONTHLY');
    });

    it('returns PRO_MONTHLY for valid input', () => {
        expect(resolveVariantCode('PRO_MONTHLY')).toBe('PRO_MONTHLY');
    });

    it('returns PRO_QUARTERLY for valid input', () => {
        expect(resolveVariantCode('PRO_QUARTERLY')).toBe('PRO_QUARTERLY');
    });

    it('returns PRO_ANNUAL for valid input', () => {
        expect(resolveVariantCode('PRO_ANNUAL')).toBe('PRO_ANNUAL');
    });

    it('returns PRO_PASS_90D for valid input', () => {
        expect(resolveVariantCode('PRO_PASS_90D')).toBe('PRO_PASS_90D');
    });
});
