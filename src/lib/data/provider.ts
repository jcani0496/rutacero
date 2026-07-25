/**
 * Data provider switch for the Supabase PostgREST → Drizzle migration.
 *
 * - `supabase` (default): existing PostgREST `.from()` / `.rpc()` paths — CI/e2e.
 * - `drizzle`: Phase 3 path — queries via `getDb()` against Railway/local Postgres.
 *
 * Set DATA_PROVIDER=drizzle only when DATABASE_URL points at a seeded DB.
 * Auth remains controlled by AUTH_PROVIDER (see `@/lib/auth/provider`).
 */
export type DataProvider = "supabase" | "drizzle";

export function getDataProvider(): DataProvider {
  const value = (process.env.DATA_PROVIDER || "supabase").toLowerCase();
  return value === "drizzle" ? "drizzle" : "supabase";
}

export function isDrizzleEnabled(): boolean {
  return getDataProvider() === "drizzle";
}
