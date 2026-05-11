import { describe, it, expect } from 'vitest';
import {
    buildDashboardSubtitle,
    extractFirstName,
    formatPlanUpdatedDate,
    isFirstSession,
} from '@/app/(app)/dashboard/header-helpers';

describe('extractFirstName', () => {
    it('returns null for null', () => {
        expect(extractFirstName(null)).toBeNull();
    });

    it('returns null for undefined', () => {
        expect(extractFirstName(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(extractFirstName('')).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
        expect(extractFirstName('   ')).toBeNull();
    });

    it('returns the only token for a single name', () => {
        expect(extractFirstName('Ana')).toBe('Ana');
    });

    it('strips trailing whitespace', () => {
        expect(extractFirstName('Ana   ')).toBe('Ana');
    });

    it('strips leading whitespace', () => {
        expect(extractFirstName('   Ana')).toBe('Ana');
    });

    it('returns the first token for multi-word names', () => {
        expect(extractFirstName('Ana María Pérez')).toBe('Ana');
    });

    it('handles tabs and multiple spaces between tokens', () => {
        expect(extractFirstName('Ana\t\tPérez')).toBe('Ana');
        expect(extractFirstName('Ana    Pérez')).toBe('Ana');
    });
});

describe('isFirstSession', () => {
    const NOW = new Date('2026-05-10T12:00:00.000Z');

    it('returns false for null', () => {
        expect(isFirstSession(null, NOW)).toBe(false);
    });

    it('returns false for undefined', () => {
        expect(isFirstSession(undefined, NOW)).toBe(false);
    });

    it('returns false for unparseable strings', () => {
        expect(isFirstSession('not-a-date', NOW)).toBe(false);
    });

    it('returns true when account was created just under 1 hour ago', () => {
        const justUnderHour = new Date(NOW.getTime() - (60 * 60 * 1000 - 1000));
        expect(isFirstSession(justUnderHour.toISOString(), NOW)).toBe(true);
    });

    it('returns false when account was created exactly 1 hour ago', () => {
        const exactlyHour = new Date(NOW.getTime() - 60 * 60 * 1000);
        expect(isFirstSession(exactlyHour.toISOString(), NOW)).toBe(false);
    });

    it('returns false when account was created just over 1 hour ago', () => {
        const justOverHour = new Date(NOW.getTime() - (60 * 60 * 1000 + 1000));
        expect(isFirstSession(justOverHour.toISOString(), NOW)).toBe(false);
    });

    it('returns true when account was created seconds ago', () => {
        const fewSecondsAgo = new Date(NOW.getTime() - 5000);
        expect(isFirstSession(fewSecondsAgo, NOW)).toBe(true);
    });

    it('returns false for a date far in the past', () => {
        expect(isFirstSession('2020-01-01T00:00:00.000Z', NOW)).toBe(false);
    });
});

describe('buildDashboardSubtitle', () => {
    it('greets a first-session user by name', () => {
        expect(
            buildDashboardSubtitle({ firstName: 'Ana', isFirstSession: true }),
        ).toBe('¡Bienvenido a RutaCero, Ana!');
    });

    it('greets a first-session user without a name', () => {
        expect(
            buildDashboardSubtitle({ firstName: null, isFirstSession: true }),
        ).toBe('Bienvenido a RutaCero.');
    });

    it('greets a returning user by name', () => {
        expect(
            buildDashboardSubtitle({ firstName: 'Ana', isFirstSession: false }),
        ).toBe('¡Hola, Ana! Aquí está el resumen de tus finanzas.');
    });

    it('falls back to the generic returning copy when no name is known', () => {
        expect(
            buildDashboardSubtitle({ firstName: null, isFirstSession: false }),
        ).toBe('Bienvenido de vuelta. Aquí está el resumen de tus finanzas.');
    });
});

describe('formatPlanUpdatedDate', () => {
    // Pin an explicit timezone in every assertion so results are deterministic
    // regardless of where CI happens to run (Vercel/UTC, dev machine, etc).
    const TZ = 'America/Guatemala';

    it('returns null for missing input', () => {
        expect(formatPlanUpdatedDate(null, TZ)).toBeNull();
        expect(formatPlanUpdatedDate(undefined, TZ)).toBeNull();
    });

    it('returns null for unparseable strings', () => {
        expect(formatPlanUpdatedDate('not-a-date', TZ)).toBeNull();
    });

    it('formats a date with two-digit day and short Spanish month', () => {
        // 2026-05-07T18:00:00Z is 2026-05-07 12:00 in America/Guatemala (UTC-6).
        expect(formatPlanUpdatedDate('2026-05-07T18:00:00Z', TZ)).toBe('07 may');
    });

    it('formats December correctly', () => {
        // 2026-12-31T18:00:00Z is 2026-12-31 12:00 in America/Guatemala.
        expect(formatPlanUpdatedDate('2026-12-31T18:00:00Z', TZ)).toBe('31 dic');
    });

    it('respects the user timezone when crossing midnight UTC', () => {
        // 2026-05-10T05:30:00Z is 2026-05-09 23:30 in America/Guatemala (UTC-6).
        // Naive server-local (UTC) formatting would render this as "10 may";
        // formatting in the user's zone must yield "09 may".
        expect(formatPlanUpdatedDate('2026-05-10T05:30:00Z', TZ)).toBe('09 may');
    });

    it('defaults to America/Guatemala when no timezone is supplied', () => {
        // Same boundary case, but exercising the default-argument path.
        expect(formatPlanUpdatedDate('2026-05-10T05:30:00Z')).toBe('09 may');
    });
});
