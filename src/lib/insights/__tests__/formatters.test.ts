import { describe, expect, it } from 'vitest';
import { formatCurrency, formatLongDate, formatMonths, formatPercent } from '../formatters';

describe('insights/formatters', () => {
    describe('formatCurrency', () => {
        it('formats in es-GT with Q prefix', () => {
            expect(formatCurrency(1234.5)).toMatch(/^Q1,234\.50$/);
        });
        it('defaults to GTQ for missing currency', () => {
            expect(formatCurrency(100)).toMatch(/^Q100\.00$/);
        });
        it('handles invalid amounts gracefully', () => {
            expect(formatCurrency(NaN)).toMatch(/Q0\.00/);
        });
        it('falls back to GTQ for unknown currency codes', () => {
            expect(formatCurrency(50, 'XXX-bad')).toMatch(/Q50\.00/);
        });
    });

    describe('formatPercent', () => {
        it('renders integers without decimals', () => {
            expect(formatPercent(24)).toBe('24%');
        });
        it('renders one decimal for fractional values', () => {
            expect(formatPercent(12.34)).toBe('12.3%');
        });
        it('handles invalid input', () => {
            expect(formatPercent(NaN)).toBe('0%');
        });
    });

    describe('formatMonths', () => {
        it('renders singular and plural months', () => {
            expect(formatMonths(1)).toBe('1 mes');
            expect(formatMonths(3)).toBe('3 meses');
        });
        it('renders whole years', () => {
            expect(formatMonths(12)).toBe('1 año');
            expect(formatMonths(24)).toBe('2 años');
        });
        it('renders mixed years and months', () => {
            expect(formatMonths(16)).toBe('1 año y 4 meses');
            expect(formatMonths(13)).toBe('1 año y 1 mes');
        });
        it('clamps non-positive values', () => {
            expect(formatMonths(0)).toBe('0 meses');
            expect(formatMonths(-5)).toBe('0 meses');
        });
    });

    describe('formatLongDate', () => {
        it('returns Spanish long form for ISO date', () => {
            const result = formatLongDate('2026-05-15T12:00:00.000Z');
            // Locale output may vary slightly across ICU versions; assert on
            // the year and month name.
            expect(result).toMatch(/2026/);
            expect(result.toLowerCase()).toMatch(/mayo/);
        });
        it('returns empty string for invalid date', () => {
            expect(formatLongDate('not-a-date')).toBe('');
        });
    });
});
