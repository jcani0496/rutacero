/**
 * Drizzle schema baseline — consolidated final state of the 51 Supabase
 * migrations (validated against backups/supabase-final/schema_snapshot.json).
 *
 * Intentional differences from the Supabase schema:
 * - No RLS policies (tenancy/ownership enforced in the app layer).
 * - No Supabase `auth` schema: FKs that pointed at auth.users(id) now point
 *   at our own `users` table (better-auth compatible, see ./auth.ts).
 * - `updated_at` triggers are not ported; writes must set updated_at
 *   explicitly (Drizzle `$onUpdate` covers ORM writes).
 * - Realtime publication (migration 017) dropped — Phase 5 replaces
 *   realtime with polling.
 * - Orphaned enums (subscription_plan, subscription_status, ticket_status)
 *   are not ported; the columns that matter use varchar + CHECK.
 */
export * from "./auth";
export * from "./tenants";
export * from "./users";
export * from "./debts";
export * from "./payments";
export * from "./notifications";
export * from "./admin";
export * from "./support";
export * from "./billing";
export * from "./funnel";
export * from "./security";
