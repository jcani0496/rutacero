import { describe, expect, it } from 'vitest';
import {
    goalStrategyReason,
    goalTypeToStrategy,
} from '@/lib/plans/goal-strategy';

describe('goalTypeToStrategy', () => {
    it('maps FASTEST → SNOWBALL', () => {
        expect(goalTypeToStrategy('FASTEST')).toBe('SNOWBALL');
    });

    it('maps LEAST_INTEREST → AVALANCHE', () => {
        expect(goalTypeToStrategy('LEAST_INTEREST')).toBe('AVALANCHE');
    });

    it('maps BALANCED → HYBRID', () => {
        expect(goalTypeToStrategy('BALANCED')).toBe('HYBRID');
    });

    it('defaults unknown/null to HYBRID', () => {
        expect(goalTypeToStrategy(undefined)).toBe('HYBRID');
        expect(goalTypeToStrategy(null)).toBe('HYBRID');
    });
});

describe('goalStrategyReason', () => {
    it('includes Según lo que elegiste copy', () => {
        expect(goalStrategyReason('FASTEST')).toMatch(/Según lo que elegiste/i);
        expect(goalStrategyReason('LEAST_INTEREST')).toMatch(/Avalancha/i);
        expect(goalStrategyReason('BALANCED')).toMatch(/Híbrido/i);
    });
});
