/**
 * Auth provider switch for the Supabase → Railway migration.
 *
 * - `supabase` (default): existing @supabase/ssr auth — used by CI/e2e today.
 * - `better-auth`: Phase 2 path — sessions in Railway/local Postgres via Drizzle.
 *
 * Set AUTH_PROVIDER / NEXT_PUBLIC_AUTH_PROVIDER=better-auth to flip the UI.
 * Server-only code should prefer AUTH_PROVIDER; client components read
 * NEXT_PUBLIC_AUTH_PROVIDER.
 */
export type AuthProvider = "supabase" | "better-auth";

export function getAuthProvider(): AuthProvider {
  const value = (
    process.env.AUTH_PROVIDER ||
    process.env.NEXT_PUBLIC_AUTH_PROVIDER ||
    "supabase"
  ).toLowerCase();
  return value === "better-auth" ? "better-auth" : "supabase";
}

export function isBetterAuthEnabled(): boolean {
  return getAuthProvider() === "better-auth";
}
