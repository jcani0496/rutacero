/**
 * Guatemala calendar-day helpers.
 *
 * RutaCero's data layer stores payment/movement dates as bare `YYYY-MM-DD`
 * strings with Guatemala-local semantics, while "now" is always a real
 * instant (usually UTC). Comparing the two with millisecond math silently
 * drops same-day items: a bare date parses to UTC midnight, which is
 * always earlier than any same-day timestamp — and for a Guatemala user
 * in the evening (UTC-6), the UTC calendar day has already rolled over to
 * tomorrow. Every comparison between "now" and a stored date must happen
 * at Guatemala calendar-day granularity, via these helpers.
 *
 * Guatemala has no DST (fixed UTC-6 year round), which keeps day
 * arithmetic on instants exact.
 */

export const GUATEMALA_TIMEZONE = 'America/Guatemala';

// en-CA formats as YYYY-MM-DD, which is both human-readable and
// lexicographically ordered — string comparison == date comparison.
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: GUATEMALA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

/** Calendar day (`YYYY-MM-DD`) of an instant, in Guatemala local time. */
export function guatemalaCalendarDay(instant: Date): string {
    return dayFormatter.format(instant);
}

/**
 * Calendar day of a stored date value.
 *
 * Bare `YYYY-MM-DD` strings already NAME a Guatemala-local calendar day —
 * they must pass through untouched (running them through the timezone
 * formatter would shift them back a day, because they parse as UTC
 * midnight = 18:00 the previous day in Guatemala). Full timestamps are
 * real instants and convert through the formatter.
 *
 * Returns null for unparseable input.
 */
export function storedDateCalendarDay(value: string): string | null {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return guatemalaCalendarDay(d);
}

/**
 * Calendar day `days` after the given instant, in Guatemala local time.
 * Exact because Guatemala has no DST.
 */
export function guatemalaCalendarDayPlus(instant: Date, days: number): string {
    return guatemalaCalendarDay(
        new Date(instant.getTime() + days * 24 * 60 * 60 * 1000),
    );
}
