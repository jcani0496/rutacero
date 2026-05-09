import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { PRO_VARIANTS } from '@/lib/billing/plans';

const variantCodes = PRO_VARIANTS.map((v) => v.code) as [string, ...string[]];

const Body = z.object({
    variantCode: z.enum(variantCodes).default('PRO_MONTHLY'),
    ctaContext: z.string().nullable().optional(),
});

describe('create-checkout body schema', () => {
    it('defaults variantCode to PRO_MONTHLY when omitted', () => {
        expect(Body.parse({}).variantCode).toBe('PRO_MONTHLY');
    });

    it('accepts known variants', () => {
        expect(Body.parse({ variantCode: 'PRO_ANNUAL' }).variantCode).toBe('PRO_ANNUAL');
        expect(Body.parse({ variantCode: 'PRO_QUARTERLY' }).variantCode).toBe('PRO_QUARTERLY');
        expect(Body.parse({ variantCode: 'PRO_PASS_90D' }).variantCode).toBe('PRO_PASS_90D');
    });

    it('rejects unknown variants', () => {
        expect(() => Body.parse({ variantCode: 'PRO_FOO' })).toThrow();
    });

    it('accepts ctaContext as string or null or omitted', () => {
        expect(Body.parse({ ctaContext: 'pricing' }).ctaContext).toBe('pricing');
        expect(Body.parse({ ctaContext: null }).ctaContext).toBeNull();
        expect(Body.parse({}).ctaContext).toBeUndefined();
    });
});
