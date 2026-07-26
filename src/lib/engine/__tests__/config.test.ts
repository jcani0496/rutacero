import { describe, expect, it } from 'vitest';
import {
    DEFAULT_HYBRID_WEIGHTS,
    parseHybridWeights,
    validateHybridWeights,
    weightsSum,
} from '@/lib/engine/config';

describe('engine config', () => {
    it('parses only the five implemented HYBRID weights', () => {
        const parsed = parseHybridWeights({
            w_rate: 0.4,
            w_balance: 0.2,
            w_due: 0.15,
            w_momentum: 0.15,
            w_type: 0.1,
            w_mora: 0.99,
            w_util: 0.99,
            w_behavior: 0.99,
            w_fx: 0.99,
        });

        expect(parsed).toEqual({
            w_rate: 0.4,
            w_balance: 0.2,
            w_due: 0.15,
            w_momentum: 0.15,
            w_type: 0.1,
        });
        expect(parsed).not.toHaveProperty('w_mora');
    });

    it('falls back to defaults for missing keys', () => {
        expect(parseHybridWeights({})).toEqual(DEFAULT_HYBRID_WEIGHTS);
    });

    it('validates weight sum equals 1', () => {
        expect(validateHybridWeights(DEFAULT_HYBRID_WEIGHTS)).toBeNull();
        expect(weightsSum(DEFAULT_HYBRID_WEIGHTS)).toBeCloseTo(1, 3);

        const invalid = { ...DEFAULT_HYBRID_WEIGHTS, w_rate: 0.5 };
        expect(validateHybridWeights(invalid)).toMatch(/sumar 1\.0/);
    });
});
