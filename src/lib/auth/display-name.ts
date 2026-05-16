/**
 * Centralized helpers for deriving a user-facing display name from an auth
 * user object. Used by every UI surface that greets the user or shows their
 * identity (header, sidebar, dashboard hero, profile, admin lists, exports).
 *
 * Keeping the resolution rules in one place means we can change the fallback
 * order or the "Usuario" copy in a single edit, and unit tests cover the
 * tricky corners (empty strings, OAuth `name` vs `full_name`, email without
 * @, etc.) so the call sites stay one-liners.
 */

const FALLBACK = 'Usuario';

/**
 * Minimal user-like shape this module operates on. We deliberately avoid
 * importing `User` from `@supabase/supabase-js` so the helper can be reused
 * with admin auth responses, server-action shaped objects, or trimmed-down
 * payloads we hand to client components.
 */
export interface DisplayNameUser {
    email?: string | null;
    user_metadata?: {
        full_name?: string | null;
        name?: string | null;
        [key: string]: unknown;
    } | null;
}

/**
 * Derives the display name for a user.
 *
 * Resolution order:
 * 1. `user_metadata.full_name` (set at signup or via the /profile editor)
 * 2. `user_metadata.name` (typically set by OAuth providers like Google)
 * 3. The email prefix (before `@`); if the email has no `@`, the whole
 *    string is used. Better to show *something* than fall through to the
 *    generic fallback when we have an email in hand.
 * 4. The literal `'Usuario'` if nothing else is available.
 *
 * Empty strings and whitespace-only values are treated as missing, since
 * Supabase metadata roundtrips often produce them and they'd otherwise
 * render as a blank line in the UI.
 */
export function getDisplayName(user: DisplayNameUser | null | undefined): string {
    if (!user) return FALLBACK;

    const fullName = trimToNonEmpty(user.user_metadata?.full_name);
    if (fullName) return fullName;

    const name = trimToNonEmpty(user.user_metadata?.name);
    if (name) return name;

    const email = trimToNonEmpty(user.email);
    if (email) {
        // `split('@')[0]` returns the whole string when there's no '@', which
        // is what we want — never produce an empty prefix when the email is
        // a non-empty value.
        const prefix = trimToNonEmpty(email.split('@')[0]);
        if (prefix) return prefix;
    }

    return FALLBACK;
}

/**
 * First-name variant for greetings like "Hola, Ana!". Returns the first
 * whitespace-delimited token of the display name.
 *
 * Returns `null` when the only thing we could derive is the literal
 * `FALLBACK`, so callers can render a generic greeting ("¡Bienvenido!")
 * instead of the awkward "¡Hola, Usuario!".
 */
export function getFirstName(user: DisplayNameUser | null | undefined): string | null {
    const display = getDisplayName(user);
    if (display === FALLBACK) return null;
    const token = display.split(/\s+/)[0]?.trim();
    return token && token.length > 0 ? token : null;
}

function trimToNonEmpty(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
