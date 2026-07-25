/**
 * Storage provider switch for Railway Buckets cutover.
 *
 * F6 default: `railway` (S3-compatible Railway Buckets via AWS SDK).
 * Legacy `supabase` storage remains only as an explicit opt-in; the runtime
 * client is removed in F6.
 *
 * Server-only code should prefer STORAGE_PROVIDER; client components read
 * NEXT_PUBLIC_STORAGE_PROVIDER.
 */
export type StorageProvider = "supabase" | "railway";

export function getStorageProvider(): StorageProvider {
  const value = (
    process.env.STORAGE_PROVIDER ||
    process.env.NEXT_PUBLIC_STORAGE_PROVIDER ||
    "railway"
  ).toLowerCase();
  return value === "supabase" ? "supabase" : "railway";
}

export function isRailwayStorageEnabled(): boolean {
  return getStorageProvider() === "railway";
}
