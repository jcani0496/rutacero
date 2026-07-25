/**
 * F6 cutover: Supabase browser client removed.
 * Call sites must use `@/lib/auth/client` (better-auth).
 */

/** @deprecated Removed in F6. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): any {
  throw new Error(
    "createClient (Supabase browser) was removed in F6. Use authClient from @/lib/auth/client.",
  );
}
