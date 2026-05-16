import { describe, expect, it } from 'vitest';
import {
    aggregate,
    missingSeries,
    nonEmptyBucketCount,
} from '../aggregator';
import type { RawMovement } from '../types';

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

const move = (overrides: Partial<RawMovement>): RawMovement => ({
    date: overrides.date ?? '2026-05-15',
    amount: overrides.amount ?? 100,
    source: overrides.source ?? 'income',
});

describe('movimientos/aggregator', () => {
    it('returns empty hasData=false when no movements', () => {
        const r = aggregate({ movements: [], granularity: 'mensual', now: utc(2026, 5, 15) });
        expect(r.hasData).toBe(false);
        expect(r.movementCount).toBe(0);
        expect(r.totals.income).toBe(0);
        expect(r.buckets.length).toBe(12);
    });

    it('sums income into the right monthly bucket', () => {
        const r = aggregate({
            movements: [
                move({ date: '2026-05-03', amount: 5000, source: 'income' }),
                move({ date: '2026-05-20', amount: 3000, source: 'income' }),
                move({ date: '2026-04-10', amount: 2000, source: 'income' }),
            ],
            granularity: 'mensual',
            now: utc(2026, 5, 15),
        });
        const may = r.buckets.find((b) => b.key === '2026-05');
        const apr = r.buckets.find((b) => b.key === '2026-04');
        expect(may?.income).toBe(8000);
        expect(apr?.income).toBe(2000);
        expect(r.totals.income).toBe(10000);
    });

    it('merges essential expenses and debt payments into "expense"', () => {
        const r = aggregate({
            movements: [
                move({ date: '2026-05-05', amount: 1000, source: 'essential_expense' }),
                move({ date: '2026-05-10', amount: 500, source: 'debt_payment' }),
            ],
            granularity: 'mensual',
            now: utc(2026, 5, 15),
        });
        const may = r.buckets.find((b) => b.key === '2026-05');
        expect(may?.expense).toBe(1500);
    });

    it('balance = income - expense per bucket and overall', () => {
        const r = aggregate({
            movements: [
                move({ date: '2026-05-01', amount: 5000, source: 'income' }),
                move({ date: '2026-05-02', amount: 2000, source: 'essential_expense' }),
                move({ date: '2026-05-03', amount: 1000, source: 'debt_payment' }),
            ],
            granularity: 'mensual',
            now: utc(2026, 5, 15),
        });
        const may = r.buckets.find((b) => b.key === '2026-05');
        expect(may?.balance).toBe(2000);
        expect(r.totals.balance).toBe(2000);
    });

    it('ignores movements outside the window', () => {
        const r = aggregate({
            movements: [
                move({ date: '2020-01-15', amount: 999, source: 'income' }),
                move({ date: '2030-01-15', amount: 999, source: 'income' }),
                move({ date: '2026-05-15', amount: 100, source: 'income' }),
            ],
            granularity: 'mensual',
            now: utc(2026, 5, 15),
        });
        expect(r.totals.income).toBe(100);
        expect(r.movementCount).toBe(1);
    });

    it('ignores invalid amounts (NaN / negative / zero)', () => {
        const r = aggregate({
            movements: [
                move({ date: '2026-05-10', amount: Number.NaN, source: 'income' }),
                move({ date: '2026-05-10', amount: -50, source: 'income' }),
                move({ date: '2026-05-10', amount: 0, source: 'income' }),
                move({ date: '2026-05-10', amount: 100, source: 'income' }),
            ],
            granularity: 'mensual',
            now: utc(2026, 5, 15),
        });
        expect(r.totals.income).toBe(100);
    });

    it('buckets diario at daily granularity', () => {
        const r = aggregate({
            movements: [
                move({ date: '2026-05-15', amount: 100, source: 'income' }),
                move({ date: '2026-05-14', amount: 200, source: 'income' }),
            ],
            granularity: 'diario',
            now: utc(2026, 5, 15),
        });
        expect(r.buckets.length).toBe(90);
        expect(r.buckets[r.buckets.length - 1].key).toBe('2026-05-15');
        expect(r.buckets[r.buckets.length - 1].income).toBe(100);
        expect(r.buckets[r.buckets.length - 2].income).toBe(200);
    });

    it('buckets quincenal correctly (Q1 vs Q2)', () => {
        const r = aggregate({
            movements: [
                move({ date: '2026-05-05', amount: 100, source: 'income' }),
                move({ date: '2026-05-20', amount: 200, source: 'income' }),
            ],
            granularity: 'quincenal',
            now: utc(2026, 5, 25),
        });
        const q1 = r.buckets.find((b) => b.key === '2026-05-Q1');
        const q2 = r.buckets.find((b) => b.key === '2026-05-Q2');
        expect(q1?.income).toBe(100);
        expect(q2?.income).toBe(200);
    });

    it('buckets semestral correctly (S1 vs S2)', () => {
        const r = aggregate({
            movements: [
                move({ date: '2026-03-15', amount: 100, source: 'income' }),
                move({ date: '2026-09-15', amount: 200, source: 'income' }),
            ],
            granularity: 'semestral',
            now: utc(2026, 12, 31),
        });
        const s1 = r.buckets.find((b) => b.key === '2026-S1');
        const s2 = r.buckets.find((b) => b.key === '2026-S2');
        expect(s1?.income).toBe(100);
        expect(s2?.income).toBe(200);
    });

    it('buckets anual correctly', () => {
        const r = aggregate({
            movements: [
                move({ date: '2024-05-15', amount: 100, source: 'income' }),
                move({ date: '2025-05-15', amount: 200, source: 'income' }),
            ],
            granularity: 'anual',
            now: utc(2026, 5, 15),
        });
        const y2024 = r.buckets.find((b) => b.key === '2024');
        const y2025 = r.buckets.find((b) => b.key === '2025');
        expect(y2024?.income).toBe(100);
        expect(y2025?.income).toBe(200);
    });

    it('flags non-empty buckets correctly', () => {
        const r = aggregate({
            movements: [move({ date: '2026-05-10', amount: 1, source: 'income' })],
            granularity: 'mensual',
            now: utc(2026, 5, 15),
        });
        expect(nonEmptyBucketCount(r)).toBe(1);
        const may = r.buckets.find((b) => b.key === '2026-05');
        expect(may?.isEmpty).toBe(false);
        const apr = r.buckets.find((b) => b.key === '2026-04');
        expect(apr?.isEmpty).toBe(true);
    });

    it('missingSeries flags missing income or expense when only one is present', () => {
        const incomeOnly = aggregate({
            movements: [move({ date: '2026-05-10', amount: 100, source: 'income' })],
            granularity: 'mensual',
            now: utc(2026, 5, 15),
        });
        expect(missingSeries(incomeOnly)).toEqual(['expense']);

        const expenseOnly = aggregate({
            movements: [move({ date: '2026-05-10', amount: 100, source: 'essential_expense' })],
            granularity: 'mensual',
            now: utc(2026, 5, 15),
        });
        expect(missingSeries(expenseOnly)).toEqual(['income']);

        const both = aggregate({
            movements: [
                move({ date: '2026-05-10', amount: 100, source: 'income' }),
                move({ date: '2026-05-10', amount: 50, source: 'essential_expense' }),
            ],
            granularity: 'mensual',
            now: utc(2026, 5, 15),
        });
        expect(missingSeries(both)).toEqual([]);
    });
});
