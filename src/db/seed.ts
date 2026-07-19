/**
 * Development seed. Idempotent (fixed UUIDs + upsert-or-skip), safe to rerun.
 *
 * Contents:
 * - Catalog data carried over from the Supabase final export
 *   (backups/supabase-final/data_public.sql): 4 feature_flags and the
 *   admin_support_settings singleton. The remaining exported rows are test
 *   users / analytics events, deliberately not seeded.
 * - Minimal dev fixtures: 1 tenant, 1 user (+profile +membership), 3 debts.
 *
 * Run: npm run db:seed:local
 */
import { getDb } from "./client";
import {
  adminSupportSettings,
  debts,
  featureFlags,
  tenantMemberships,
  tenants,
  userProfiles,
  users,
} from "./schema";

const DEV_USER_ID = "00000000-0000-4000-8000-000000000001";
const DEV_TENANT_ID = "00000000-0000-4000-8000-000000000010";

const DEV_DEBTS = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    type: "CREDIT_CARD",
    creditor: "Banco Industrial Visa",
    balance: "8500.00",
    currency: "GTQ",
    apr: "42.5",
    minPayment: "425.00",
    dueDate: 15,
    nextPaymentDate: "2026-08-15",
    status: "ACTIVE",
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    type: "LOAN",
    creditor: "Banrural préstamo personal",
    balance: "25000.00",
    currency: "GTQ",
    apr: "18.0",
    minPayment: "1200.00",
    fixedPayment: "1200.00",
    dueDate: 5,
    nextPaymentDate: "2026-08-05",
    status: "ACTIVE",
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    type: "INFORMAL",
    creditor: "Préstamo familiar",
    balance: "3000.00",
    currency: "GTQ",
    minPayment: "500.00",
    nextPaymentDate: "2026-08-30",
    status: "ACTIVE",
  },
] as const;

// Catalog: feature_flags from the Supabase export (same keys/status/rules).
const FEATURE_FLAGS = [
  {
    id: "086ad8f4-53ad-4ee9-a0c0-898046ed3af7",
    key: "hybrid_engine",
    status: "ENABLED",
    rules: {},
  },
  {
    id: "b7c8d0c9-90cc-4b18-8c46-c0a283b4e6b9",
    key: "forecast_extended",
    status: "DISABLED",
    rules: { plans: ["BUSINESS"] },
  },
  {
    id: "c01445d3-c4e6-46e4-a186-fb64854fa3c5",
    key: "export_csv",
    status: "ENABLED",
    rules: { plans: ["PRO", "BUSINESS"] },
  },
  {
    id: "e3203f3a-fe1c-47f0-9864-68015e6d1795",
    key: "export_pdf",
    status: "ENABLED",
    rules: { plans: ["PRO", "BUSINESS"] },
  },
] as const;

async function seed() {
  const db = getDb();

  await db
    .insert(featureFlags)
    .values(FEATURE_FLAGS.map((f) => ({ ...f, rules: f.rules as object })))
    .onConflictDoNothing({ target: featureFlags.key });

  // Support settings singleton from the export (same values, fixed id).
  await db
    .insert(adminSupportSettings)
    .values({
      id: "32c14a22-4e26-41b2-87b8-a5b2d4ebc9f6",
      autoAssignEnabled: false,
      autoAssignStrategy: "LOAD_BALANCED",
      autoAssignPriorities: ["URGENT", "HIGH", "MEDIUM", "LOW"],
      lastRoundRobinIndex: 0,
      slaEscalationEnabled: false,
      staleReassignEnabled: false,
      staleReassignHours: 24,
    })
    .onConflictDoNothing({ target: adminSupportSettings.id });

  await db
    .insert(users)
    .values({
      id: DEV_USER_ID,
      name: "Dev User",
      email: "dev@rutacero.local",
      emailVerified: true,
    })
    .onConflictDoNothing({ target: users.id });

  await db
    .insert(tenants)
    .values({
      id: DEV_TENANT_ID,
      slug: "dev-tenant",
      name: "Dev Tenant",
      createdByUserId: DEV_USER_ID,
    })
    .onConflictDoNothing({ target: tenants.id });

  await db
    .insert(tenantMemberships)
    .values({ tenantId: DEV_TENANT_ID, userId: DEV_USER_ID, role: "OWNER" })
    .onConflictDoNothing();

  await db
    .insert(userProfiles)
    .values({
      userId: DEV_USER_ID,
      currentTenantId: DEV_TENANT_ID,
      onboardingCompleted: true,
    })
    .onConflictDoNothing({ target: userProfiles.userId });

  await db
    .insert(debts)
    .values(
      DEV_DEBTS.map((d) => ({
        ...d,
        userId: DEV_USER_ID,
        tenantId: DEV_TENANT_ID,
      })),
    )
    .onConflictDoNothing({ target: debts.id });

  console.log("Seed completed: 1 tenant, 1 user, 3 debts, catalog data.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
