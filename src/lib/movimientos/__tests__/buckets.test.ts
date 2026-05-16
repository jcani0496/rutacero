import { describe, expect, it } from 'vitest';
import {
    addDays,
    addMonths,
    biweekOf,
    bucketKey,
    bucketRange,
    buildWindow,
    formatISODate,
    halfOf,
    isoWeek,
    parseDate,
    quarterOf,
    startOfIsoWeek,
    stepBucket,
} from '../buckets';

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe('movimientos/buckets', () => {
    describe('parseDate', () => {
        it('parses YYYY-MM-DD as UTC midnight', () => {
            const d = parseDate('2026-05-15');
            expect(d.getUTCFullYear()).toBe(2026);
            expect(d.getUTCMonth()).toBe(4);
            expect(d.getUTCDate()).toBe(15);
            expect(d.getUTCHours()).toBe(0);
        });
        it('accepts full ISO timestamps by truncating to the date portion', () => {
            const d = parseDate('2026-05-15T18:30:00.000Z');
            expect(d.getUTCDate()).toBe(15);
        });
    });

    describe('formatISODate', () => {
        it('round-trips with parseDate', () => {
            expect(formatISODate(parseDate('2026-01-09'))).toBe('2026-01-09');
        });
    });

    describe('addDays / addMonths', () => {
        it('adds days across month boundaries', () => {
            expect(formatISODate(addDays(utc(2026, 1, 30), 5))).toBe('2026-02-04');
        });
        it('adds months and clamps to end of month', () => {
            // Jan 31 + 1 month -> Feb 28 (2026 is not a leap year)
            expect(formatISODate(addMonths(utc(2026, 1, 31), 1))).toBe('2026-02-28');
        });
    });

    describe('isoWeek + startOfIsoWeek', () => {
        it('returns ISO week 1 for Jan 5 2026 (Monday)', () => {
            const { year, week } = isoWeek(utc(2026, 1, 5));
            expect(year).toBe(2026);
            expect(week).toBe(2);
        });
        it('startOfIsoWeek snaps to Monday', () => {
            // 2026-05-15 is Friday
            const monday = startOfIsoWeek(utc(2026, 5, 15));
            expect(formatISODate(monday)).toBe('2026-05-11');
        });
    });

    describe('quarterOf / halfOf / biweekOf', () => {
        it('quarter labels', () => {
            expect(quarterOf(utc(2026, 1, 1))).toBe(1);
            expect(quarterOf(utc(2026, 4, 1))).toBe(2);
            expect(quarterOf(utc(2026, 7, 1))).toBe(3);
            expect(quarterOf(utc(2026, 10, 1))).toBe(4);
        });
        it('semester labels split at July', () => {
            expect(halfOf(utc(2026, 6, 30))).toBe(1);
            expect(halfOf(utc(2026, 7, 1))).toBe(2);
        });
        it('quincena splits on day 15/16', () => {
            expect(biweekOf(utc(2026, 5, 15))).toBe(1);
            expect(biweekOf(utc(2026, 5, 16))).toBe(2);
        });
    });

    describe('bucketKey', () => {
        const d = utc(2026, 5, 16); // Friday May 16 2026, quincena 2, ISO week 20
        it('diario uses YYYY-MM-DD', () => {
            expect(bucketKey(d, 'diario')).toBe('2026-05-16');
        });
        it('semanal uses YYYY-Www', () => {
            expect(bucketKey(d, 'semanal')).toMatch(/^2026-W\d{2}$/);
        });
        it('quincenal uses YYYY-MM-Q[12]', () => {
            expect(bucketKey(d, 'quincenal')).toBe('2026-05-Q2');
            expect(bucketKey(utc(2026, 5, 1), 'quincenal')).toBe('2026-05-Q1');
        });
        it('mensual uses YYYY-MM', () => {
            expect(bucketKey(d, 'mensual')).toBe('2026-05');
        });
        it('trimestral uses YYYY-T[1-4]', () => {
            expect(bucketKey(d, 'trimestral')).toBe('2026-T2');
        });
        it('semestral uses YYYY-S[12]', () => {
            expect(bucketKey(d, 'semestral')).toBe('2026-S1');
            expect(bucketKey(utc(2026, 7, 1), 'semestral')).toBe('2026-S2');
        });
        it('anual uses YYYY', () => {
            expect(bucketKey(d, 'anual')).toBe('2026');
        });
    });

    describe('bucketRange', () => {
        it('mensual range covers the whole month', () => {
            const r = bucketRange(utc(2026, 2, 14), 'mensual');
            expect(formatISODate(r.start)).toBe('2026-02-01');
            expect(formatISODate(r.end)).toBe('2026-02-28');
        });
        it('quincenal Q1 = 1-15 of month', () => {
            const r = bucketRange(utc(2026, 5, 7), 'quincenal');
            expect(formatISODate(r.start)).toBe('2026-05-01');
            expect(formatISODate(r.end)).toBe('2026-05-15');
        });
        it('quincenal Q2 = 16-end of month', () => {
            const r = bucketRange(utc(2026, 5, 20), 'quincenal');
            expect(formatISODate(r.start)).toBe('2026-05-16');
            expect(formatISODate(r.end)).toBe('2026-05-31');
        });
        it('trimestral range covers 3 months', () => {
            const r = bucketRange(utc(2026, 5, 1), 'trimestral');
            expect(formatISODate(r.start)).toBe('2026-04-01');
            expect(formatISODate(r.end)).toBe('2026-06-30');
        });
        it('semestral S2 = jul-dec', () => {
            const r = bucketRange(utc(2026, 9, 1), 'semestral');
            expect(formatISODate(r.start)).toBe('2026-07-01');
            expect(formatISODate(r.end)).toBe('2026-12-31');
        });
        it('anual range covers full year', () => {
            const r = bucketRange(utc(2026, 6, 1), 'anual');
            expect(formatISODate(r.start)).toBe('2026-01-01');
            expect(formatISODate(r.end)).toBe('2026-12-31');
        });
    });

    describe('stepBucket', () => {
        it('mensual steps backward across year boundary', () => {
            const prior = stepBucket(utc(2026, 1, 15), 'mensual', -1);
            expect(prior.getUTCFullYear()).toBe(2025);
            expect(prior.getUTCMonth()).toBe(11);
        });
        it('quincenal alternates Q1/Q2 within a month', () => {
            const next = stepBucket(utc(2026, 5, 5), 'quincenal', 1); // from Q1 -> Q2 same month
            expect(formatISODate(next)).toBe('2026-05-16');
        });
        it('quincenal Q2 -> Q1 of next month', () => {
            const next = stepBucket(utc(2026, 5, 20), 'quincenal', 1);
            expect(formatISODate(next)).toBe('2026-06-01');
        });
    });

    describe('buildWindow', () => {
        it('produces the right bucket counts for each granularity', () => {
            const now = utc(2026, 5, 15);
            expect(buildWindow(now, 'diario').length).toBe(90);
            expect(buildWindow(now, 'semanal').length).toBe(26);
            expect(buildWindow(now, 'quincenal').length).toBe(12);
            expect(buildWindow(now, 'mensual').length).toBe(12);
            expect(buildWindow(now, 'trimestral').length).toBe(8);
            expect(buildWindow(now, 'semestral').length).toBe(6);
            expect(buildWindow(now, 'anual').length).toBe(5);
        });
        it('mensual window ends in the bucket containing "now"', () => {
            const w = buildWindow(utc(2026, 5, 15), 'mensual');
            const last = w[w.length - 1];
            expect(last.key).toBe('2026-05');
        });
        it('anual window ends in the year containing "now"', () => {
            const w = buildWindow(utc(2026, 5, 15), 'anual');
            const last = w[w.length - 1];
            expect(last.key).toBe('2026');
            const first = w[0];
            expect(first.key).toBe('2022');
        });
        it('keys are unique (no duplicate buckets)', () => {
            const w = buildWindow(utc(2026, 5, 15), 'quincenal');
            const keys = w.map((b) => b.key);
            expect(new Set(keys).size).toBe(keys.length);
        });
        it('all bucket starts in the window are <= now', () => {
            const now = utc(2026, 5, 15);
            const w = buildWindow(now, 'diario');
            for (const b of w) {
                expect(new Date(b.bucketStart).getTime()).toBeLessThanOrEqual(now.getTime());
            }
        });
    });
});
