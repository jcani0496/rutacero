/**
 * Pure helpers for the dashboard header.
 * Kept separate from the page component so they can be unit tested
 * without mocking Next.js or Supabase.
 */

const FIRST_SESSION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Extract the user's first name from a display string.
 * Trims whitespace and returns the first whitespace-delimited token.
 * Returns null when input is null/undefined or empty after trimming.
 */
export function extractFirstName(displayName: string | null | undefined): string | null {
    if (!displayName) return null;
    const trimmed = displayName.trim();
    if (!trimmed) return null;
    const [first] = trimmed.split(/\s+/);
    return first || null;
}

/**
 * Determine whether the user's account was created within the last hour.
 * Accepts ISO strings, Date instances, or null/undefined.
 * Returns false when the input is missing or unparseable.
 */
export function isFirstSession(
    createdAt: string | Date | null | undefined,
    now: Date = new Date(),
): boolean {
    if (!createdAt) return false;
    const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
    const createdMs = created.getTime();
    if (Number.isNaN(createdMs)) return false;
    return now.getTime() - createdMs < FIRST_SESSION_WINDOW_MS;
}

interface BuildSubtitleArgs {
    firstName: string | null;
    isFirstSession: boolean;
}

/**
 * Compose the personalized dashboard subtitle.
 * Falls back to the original generic copy when no first name is known.
 */
export function buildDashboardSubtitle({ firstName, isFirstSession }: BuildSubtitleArgs): string {
    if (isFirstSession && firstName) {
        return `¡Bienvenido a RutaCero, ${firstName}!`;
    }
    if (isFirstSession && !firstName) {
        return "Bienvenido a RutaCero.";
    }
    if (!isFirstSession && firstName) {
        return `¡Hola, ${firstName}! Aquí está el resumen de tus finanzas.`;
    }
    return "Bienvenido de vuelta. Aquí está el resumen de tus finanzas.";
}

const SPANISH_MONTHS_SHORT = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
];

/**
 * Format a date as "DD MMM" using Spanish month abbreviations.
 * Returns null for missing/invalid input.
 */
export function formatPlanUpdatedDate(value: string | Date | null | undefined): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const day = String(date.getDate()).padStart(2, "0");
    const month = SPANISH_MONTHS_SHORT[date.getMonth()];
    return `${day} ${month}`;
}
