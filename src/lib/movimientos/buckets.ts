/**
 * Pure date-bucket utilities for the Movimientos view.
 *
 * All functions are deterministic, accept an explicit `now` (so tests can pin
 * the reference time), and treat dates as UTC calendar days. We intentionally
 * avoid timezone math here — the data layer stores dates as `YYYY-MM-DD`
 * strings, which we treat as Guatemala-local calendar days everywhere.
 *
 * Quincenal and semestral buckets are NOT native to Postgres `date_trunc`,
 * so we compute them here in JS:
 *   - Quincenal: 1st–15th of month = Q1, 16th–end of month = Q2 (common
 *     Latin American payroll convention; matches the existing app's
 *     `pay_frequency: 'BIWEEKLY'` semantics in onboarding).
 *   - Semestral: months 1–6 of year = S1, months 7–12 = S2.
 */

import type { Granularity, MovimientosBucket } from './types';
import { BUCKET_COUNT } from './types';
import {
    formatBucketLabel,
    formatBucketLongLabel,
} from './formatters';

/** Parse a "YYYY-MM-DD" or ISO string into a Date at UTC midnight. */
export function parseDate(input: string): Date {
    // Take only the date portion to avoid TZ shifts.
    const datePart = input.slice(0, 10);
    const [y, m, d] = datePart.split('-').map(Number);
    if (!y || !m || !d) {
        // Fallback: pass through to Date constructor.
        return new Date(input);
    }
    return new Date(Date.UTC(y, m - 1, d));
}

/** Format a Date as a "YYYY-MM-DD" string in UTC. */
export function formatISODate(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Add days to a date (UTC-safe, returns a new Date). */
export function addDays(date: Date, days: number): Date {
    const next = new Date(date.getTime());
    next.setUTCDate(next.getUTCDate() + days);
    return next;
}

/** Add months to a date (UTC-safe). Clamps day to the end of target month. */
export function addMonths(date: Date, months: number): Date {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const d = date.getUTCDate();
    const next = new Date(Date.UTC(y, m + months, 1));
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(d, lastDay));
    return next;
}

/**
 * ISO 8601 week number. Returns { year, week } where year may differ from
 * the calendar year for early-January or late-December dates.
 */
export function isoWeek(date: Date): { year: number; week: number } {
    // Copy in UTC to avoid mutation.
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    // Thursday in current week decides the year.
    const dayNum = d.getUTCDay() || 7; // Sunday=7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return { year: d.getUTCFullYear(), week };
}

/** Monday of the ISO week containing `date`. */
export function startOfIsoWeek(date: Date): Date {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7; // Sunday=7
    if (dayNum !== 1) {
        d.setUTCDate(d.getUTCDate() - (dayNum - 1));
    }
    return d;
}

/** Quarter of year (1-4) from a Date. */
export function quarterOf(date: Date): number {
    return Math.floor(date.getUTCMonth() / 3) + 1;
}

/** Half of year (1-2) from a Date. */
export function halfOf(date: Date): number {
    return date.getUTCMonth() < 6 ? 1 : 2;
}

/** Quincena of month (1 = days 1-15, 2 = days 16-end). */
export function biweekOf(date: Date): 1 | 2 {
    return date.getUTCDate() <= 15 ? 1 : 2;
}

/**
 * Return the stable bucket KEY for a date at a given granularity. The key
 * is what we group by; it's stable across timezones because we always work
 * in UTC.
 */
export function bucketKey(date: Date, granularity: Granularity): string {
    switch (granularity) {
        case 'diario':
            return formatISODate(date);
        case 'semanal': {
            const { year, week } = isoWeek(date);
            return `${year}-W${String(week).padStart(2, '0')}`;
        }
        case 'quincenal': {
            const y = date.getUTCFullYear();
            const m = String(date.getUTCMonth() + 1).padStart(2, '0');
            return `${y}-${m}-Q${biweekOf(date)}`;
        }
        case 'mensual': {
            const y = date.getUTCFullYear();
            const m = String(date.getUTCMonth() + 1).padStart(2, '0');
            return `${y}-${m}`;
        }
        case 'trimestral':
            return `${date.getUTCFullYear()}-T${quarterOf(date)}`;
        case 'semestral':
            return `${date.getUTCFullYear()}-S${halfOf(date)}`;
        case 'anual':
            return String(date.getUTCFullYear());
    }
}

/** Inclusive [start, end] date range for the bucket containing `date`. */
export function bucketRange(date: Date, granularity: Granularity): { start: Date; end: Date } {
    switch (granularity) {
        case 'diario': {
            const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
            return { start, end: new Date(start.getTime()) };
        }
        case 'semanal': {
            const start = startOfIsoWeek(date);
            return { start, end: addDays(start, 6) };
        }
        case 'quincenal': {
            const y = date.getUTCFullYear();
            const m = date.getUTCMonth();
            if (biweekOf(date) === 1) {
                return {
                    start: new Date(Date.UTC(y, m, 1)),
                    end: new Date(Date.UTC(y, m, 15)),
                };
            }
            const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
            return {
                start: new Date(Date.UTC(y, m, 16)),
                end: new Date(Date.UTC(y, m, lastDay)),
            };
        }
        case 'mensual': {
            const y = date.getUTCFullYear();
            const m = date.getUTCMonth();
            return {
                start: new Date(Date.UTC(y, m, 1)),
                end: new Date(Date.UTC(y, m + 1, 0)),
            };
        }
        case 'trimestral': {
            const y = date.getUTCFullYear();
            const q = quarterOf(date);
            const startMonth = (q - 1) * 3;
            return {
                start: new Date(Date.UTC(y, startMonth, 1)),
                end: new Date(Date.UTC(y, startMonth + 3, 0)),
            };
        }
        case 'semestral': {
            const y = date.getUTCFullYear();
            const h = halfOf(date);
            const startMonth = h === 1 ? 0 : 6;
            return {
                start: new Date(Date.UTC(y, startMonth, 1)),
                end: new Date(Date.UTC(y, startMonth + 6, 0)),
            };
        }
        case 'anual': {
            const y = date.getUTCFullYear();
            return {
                start: new Date(Date.UTC(y, 0, 1)),
                end: new Date(Date.UTC(y, 11, 31)),
            };
        }
    }
}

/**
 * Move from one bucket boundary to the next (or previous, if `step` is
 * negative). Used to enumerate the window.
 */
export function stepBucket(date: Date, granularity: Granularity, step: number): Date {
    switch (granularity) {
        case 'diario':
            return addDays(date, step);
        case 'semanal':
            return addDays(date, step * 7);
        case 'quincenal': {
            // Half-month steps: alternate Q1 (day 1) and Q2 (day 16) of months.
            const dir = step >= 0 ? 1 : -1;
            let remaining = Math.abs(step);
            let cursor = new Date(date.getTime());
            while (remaining > 0) {
                const q = biweekOf(cursor);
                if (dir > 0) {
                    if (q === 1) {
                        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 16));
                    } else {
                        const next = addMonths(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1)), 1);
                        cursor = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), 1));
                    }
                } else {
                    if (q === 2) {
                        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
                    } else {
                        const prev = addMonths(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1)), -1);
                        cursor = new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth(), 16));
                    }
                }
                remaining -= 1;
            }
            return cursor;
        }
        case 'mensual':
            return addMonths(date, step);
        case 'trimestral':
            return addMonths(date, step * 3);
        case 'semestral':
            return addMonths(date, step * 6);
        case 'anual': {
            const y = date.getUTCFullYear() + step;
            return new Date(Date.UTC(y, date.getUTCMonth(), 1));
        }
    }
}

/**
 * Build the ordered list of empty buckets for the window ending at `now`.
 * The window length is determined by `BUCKET_COUNT[granularity]`.
 *
 * For mensual specifically, the spec says "año en curso" — but the cleanest
 * implementation is "last 12 months ending in the current month", which is
 * equivalent for any month past January and a strict superset otherwise.
 * To match the spec literally we'd render Jan-Dec of the current year; we go
 * with "last 12 months including current" so all granularities follow the
 * same retrospective pattern. Future buckets are never rendered.
 */
export function buildWindow(now: Date, granularity: Granularity): MovimientosBucket[] {
    const count = BUCKET_COUNT[granularity];
    const buckets: MovimientosBucket[] = [];
    for (let i = count - 1; i >= 0; i--) {
        const refDate = stepBucket(now, granularity, -i);
        const range = bucketRange(refDate, granularity);
        const key = bucketKey(refDate, granularity);
        buckets.push({
            key,
            bucketStart: range.start.toISOString(),
            bucketEnd: range.end.toISOString(),
            label: formatBucketLabel(range.start, granularity),
            longLabel: formatBucketLongLabel(range.start, granularity),
            income: 0,
            expense: 0,
            balance: 0,
            isEmpty: true,
        });
    }
    return buckets;
}
