/**
 * Auth provider switch for the Supabase → better-auth cutover.
 *
 * F6 default: `better-auth` (sessions in Railway/local Postgres).
 * Legacy `supabase` auth remains only as an explicit opt-in; the runtime
 * client is removed in F6.
 *
 * Server-only code should prefer AUTH_PROVIDER; client components read
 * NEXT_PUBLIC_AUTH_PROVIDER.
 */
export type AuthProvider = "supabase" | "better-auth";

export function getAuthProvider(): AuthProvider {
  const value = (
    process.env.AUTH_PROVIDER ||
    process.env.NEXT_PUBLIC_AUTH_PROVIDER ||
    "better-auth"
  ).toLowerCase();
  return value === "supabase" ? "supabase" : "better-auth";
}

export function isBetterAuthEnabled(): boolean {
  return getAuthProvider() === "better-auth";
}
