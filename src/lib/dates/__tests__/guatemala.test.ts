import { describe, it, expect } from 'vitest';
import {
    guatemalaCalendarDay,
    guatemalaCalendarDayPlus,
    storedDateCalendarDay,
} from '../guatemala';

describe('guatemala calendar-day helpers', () => {
    describe('guatemalaCalendarDay', () => {
        it('maps a UTC noon instant to the same calendar day', () => {
            expect(guatemalaCalendarDay(new Date('2026-05-15T12:00:00Z'))).toBe(
                '2026-05-15',
            );
        });

        it('rolls back to the previous day for early-UTC instants (GT evening)', () => {
            // 2026-07-19T02:00Z == 2026-07-18 20:00 in Guatemala.
            expect(guatemalaCalendarDay(new Date('2026-07-19T02:00:00Z'))).toBe(
                '2026-07-18',
            );
        });

        it('keeps the day for a UTC instant after 06:00', () => {
            expect(guatemalaCalendarDay(new Date('2026-07-19T06:00:00Z'))).toBe(
                '2026-07-19',
            );
        });
    });

    describe('storedDateCalendarDay', () => {
        it('passes bare YYYY-MM-DD strings through untouched', () => {
            // Critically: NOT shifted back a day by timezone conversion.
            expect(storedDateCalendarDay('2026-05-15')).toBe('2026-05-15');
        });

        it('converts full timestamps through Guatemala time', () => {
            expect(storedDateCalendarDay('2026-07-19T02:00:00Z')).toBe('2026-07-18');
        });

        it('returns null for garbage', () => {
            expect(storedDateCalendarDay('not-a-date')).toBeNull();
        });
    });

    describe('guatemalaCalendarDayPlus', () => {
        it('adds days at GT granularity', () => {
            expect(
                guatemalaCalendarDayPlus(new Date('2026-05-15T12:00:00Z'), 7),
            ).toBe('2026-05-22');
        });

        it('crosses month boundaries', () => {
            expect(
                guatemalaCalendarDayPlus(new Date('2026-05-30T12:00:00Z'), 7),
            ).toBe('2026-06-06');
        });
    });
});
