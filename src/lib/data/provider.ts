/**
 * Data provider switch for the Railway/Drizzle cutover.
 *
 * F6 default: `drizzle` (Railway/local Postgres via getDb()).
 * Legacy `supabase` PostgREST path remains only as an explicit opt-in
 * during the migration window; it throws at runtime once @supabase is removed.
 */
export type DataProvider = "supabase" | "drizzle";

export function getDataProvider(): DataProvider {
  const value = (process.env.DATA_PROVIDER || "drizzle").toLowerCase();
  return value === "supabase" ? "supabase" : "drizzle";
}

export function isDrizzleEnabled(): boolean {
  return getDataProvider() === "drizzle";
}
