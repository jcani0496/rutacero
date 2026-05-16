import { describe, expect, it } from 'vitest';
import {
    formatBucketLabel,
    formatBucketLongLabel,
    formatCurrency,
    granularityLabel,
    periodLabel,
} from '../formatters';

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe('movimientos/formatters', () => {
    describe('formatCurrency', () => {
        it('formats as Q with two decimals, no NBSP', () => {
            expect(formatCurrency(1234.56)).toMatch(/^Q1,234\.56$/);
        });
        it('defaults to GTQ', () => {
            expect(formatCurrency(50)).toMatch(/^Q50\.00$/);
        });
        it('handles non-finite gracefully', () => {
            expect(formatCurrency(Number.NaN)).toMatch(/Q0\.00/);
        });
        it('falls back to GTQ for invalid currency codes', () => {
            expect(formatCurrency(10, 'NOT-A-CCY')).toMatch(/Q10\.00/);
        });
    });

    describe('formatBucketLabel', () => {
        const may15 = utc(2026, 5, 15);
        it('diario: dd MMM', () => {
            expect(formatBucketLabel(may15, 'diario')).toBe('15 May');
        });
        it('semanal: dd MMM (week start)', () => {
            expect(formatBucketLabel(may15, 'semanal')).toBe('15 May');
        });
        it('quincenal: short month + Q1/Q2', () => {
            expect(formatBucketLabel(utc(2026, 5, 1), 'quincenal')).toBe('May Q1');
            expect(formatBucketLabel(utc(2026, 5, 16), 'quincenal')).toBe('May Q2');
        });
        it('mensual: short month', () => {
            expect(formatBucketLabel(may15, 'mensual')).toBe('May');
        });
        it('trimestral: TX YYYY', () => {
            expect(formatBucketLabel(utc(2026, 4, 1), 'trimestral')).toBe('T2 2026');
        });
        it('semestral: SX YYYY', () => {
            expect(formatBucketLabel(utc(2026, 7, 1), 'semestral')).toBe('S2 2026');
        });
        it('anual: YYYY', () => {
            expect(formatBucketLabel(may15, 'anual')).toBe('2026');
        });
    });

    describe('formatBucketLongLabel', () => {
        it('mensual long label uses long month name', () => {
            const lbl = formatBucketLongLabel(utc(2026, 5, 1), 'mensual');
            expect(lbl.toLowerCase()).toContain('mayo');
            expect(lbl).toContain('2026');
        });
        it('quincenal long label distinguishes 1ra/2da', () => {
            expect(formatBucketLongLabel(utc(2026, 5, 1), 'quincenal')).toMatch(/1ra/);
            expect(formatBucketLongLabel(utc(2026, 5, 16), 'quincenal')).toMatch(/2da/);
        });
        it('anual long label is "Año YYYY"', () => {
            expect(formatBucketLongLabel(utc(2026, 1, 1), 'anual')).toBe('Año 2026');
        });
    });

    describe('periodLabel', () => {
        it('returns the right Spanish phrase per granularity', () => {
            expect(periodLabel('diario')).toBe('los últimos 90 días');
            expect(periodLabel('mensual')).toBe('los últimos 12 meses');
            expect(periodLabel('anual')).toBe('los últimos 5 años');
        });
    });

    describe('granularityLabel', () => {
        it('returns the Spanish title for each granularity', () => {
            expect(granularityLabel('diario')).toBe('Diario');
            expect(granularityLabel('mensual')).toBe('Mensual');
            expect(granularityLabel('semestral')).toBe('Semestral');
        });
    });
});
