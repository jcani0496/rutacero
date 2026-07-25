/**
 * Storage provider switch for the Supabase Storage → Railway Buckets migration.
 *
 * - `supabase` (default): existing `@supabase/supabase-js` storage — CI/e2e.
 * - `railway`: Phase 4 path — S3-compatible Railway Buckets via AWS SDK.
 *
 * Set STORAGE_PROVIDER / NEXT_PUBLIC_STORAGE_PROVIDER=railway when the
 * Railway bucket credentials are wired (see `.env.example`).
 * Server-only code should prefer STORAGE_PROVIDER; client components read
 * NEXT_PUBLIC_STORAGE_PROVIDER.
 */
export type StorageProvider = "supabase" | "railway";

export function getStorageProvider(): StorageProvider {
  const value = (
    process.env.STORAGE_PROVIDER ||
    process.env.NEXT_PUBLIC_STORAGE_PROVIDER ||
    "supabase"
  ).toLowerCase();
  return value === "railway" ? "railway" : "supabase";
}

export function isRailwayStorageEnabled(): boolean {
  return getStorageProvider() === "railway";
}
