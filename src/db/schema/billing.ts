import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { tenants } from "./tenants";
import { adminUsers } from "./admin";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planCode: varchar("plan_code", { length: 20 }).notNull().default("FREE"),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    provider: varchar("provider", { length: 50 })
      .notNull()
      .default("recurrente"),
    externalId: varchar("external_id", { length: 255 }),
    startAt: timestamp("start_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    renewAt: timestamp("renew_at", { withTimezone: true }),
    cancelAt: timestamp("cancel_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    tenantId: uuid("tenant_id").notNull(),
    purchaserUserId: uuid("purchaser_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    attributionId: text("attribution_id"),
    marketingContext: jsonb("marketing_context")
      .notNull()
      .default(sql`'{}'::jsonb`),
    billingInterval: varchar("billing_interval", { length: 16 })
      .notNull()
      .default("monthly"),
    priceAmountQ: numeric("price_amount_q"),
    paymentMethod: varchar("payment_method", { length: 32 })
      .notNull()
      .default("recurrente"),
  },
  (table) => [
    index("idx_subscriptions_status").on(table.status),
    index("idx_subscriptions_tenant").on(table.tenantId),
    index("idx_subscriptions_attribution_id").on(table.attributionId),
    uniqueIndex("idx_subscriptions_external")
      .on(table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
    // One subscription per tenant (multi-tenant billing model).
    uniqueIndex("idx_subscriptions_tenant_unique").on(table.tenantId),
    check(
      "subscriptions_plan_code_check",
      sql`${table.planCode} IN ('FREE', 'PRO', 'BUSINESS')`,
    ),
    check(
      "subscriptions_status_check",
      sql`${table.status} IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED')`,
    ),
    check(
      "subscriptions_billing_interval_check",
      sql`${table.billingInterval} IN ('monthly', 'quarterly', 'yearly', 'pass_30d', 'pass_90d')`,
    ),
    check(
      "subscriptions_payment_method_check",
      sql`${table.paymentMethod} IN ('recurrente', 'google_play', 'manual_transfer', 'admin_grant', 'free')`,
    ),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    amount: numeric("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("GTQ"),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    pdfUrl: text("pdf_url"),
    tenantId: uuid("tenant_id").notNull(),
  },
  (table) => [
    index("idx_invoices_user_id").on(table.userId),
    index("idx_invoices_subscription_id").on(table.subscriptionId),
    index("idx_invoices_tenant").on(table.tenantId),
    check("invoices_amount_check", sql`${table.amount} > 0`),
    check(
      "invoices_currency_check",
      sql`${table.currency} IN ('GTQ', 'USD')`,
    ),
    check(
      "invoices_status_check",
      sql`${table.status} IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')`,
    ),
  ],
);

export const billingEntitlements = pgTable(
  "billing_entitlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).notNull(),
    platform: varchar("platform", { length: 20 }).notNull(),
    productId: varchar("product_id", { length: 100 }).notNull(),
    purchaseToken: varchar("purchase_token", { length: 255 }).notNull(),
    orderId: varchar("order_id", { length: 255 }),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    rawResponse: jsonb("raw_response").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("billing_entitlements_provider_purchase_token_key").on(
      table.provider,
      table.purchaseToken,
    ),
    index("idx_billing_entitlements_tenant_status").on(
      table.tenantId,
      table.status,
    ),
    index("idx_billing_entitlements_user_provider").on(
      table.userId,
      table.provider,
    ),
    check(
      "billing_entitlements_platform_check",
      sql`${table.platform} IN ('android', 'web')`,
    ),
    check(
      "billing_entitlements_status_check",
      sql`${table.status} IN ('ACTIVE', 'EXPIRED', 'REVOKED')`,
    ),
  ],
);

export const manualPaymentGrants = pgTable(
  "manual_payment_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    grantedByAdminId: uuid("granted_by_admin_id")
      .notNull()
      .references(() => adminUsers.id),
    variantCode: varchar("variant_code", { length: 32 }).notNull(),
    priceAmountQ: numeric("price_amount_q").notNull(),
    bankReference: varchar("bank_reference", { length: 120 })
      .notNull()
      .unique("uq_manual_grants_bank_reference"),
    durationDays: integer("duration_days").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_manual_payment_grants_tenant").on(table.tenantId),
    index("idx_manual_payment_grants_expires").on(table.expiresAt),
    check(
      "manual_payment_grants_duration_days_check",
      sql`${table.durationDays} > 0 AND ${table.durationDays} <= 400`,
    ),
  ],
);

export const pendingManualTransfers = pgTable(
  "pending_manual_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    variantCode: varchar("variant_code", { length: 32 }).notNull(),
    referenceCode: varchar("reference_code", { length: 80 })
      .notNull()
      .unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_pending_manual_transfers_tenant").on(table.tenantId),
    index("idx_pending_manual_transfers_pending_expires")
      .on(table.expiresAt)
      .where(sql`${table.consumedAt} IS NULL`),
  ],
);

export const recurrenteCheckoutContexts = pgTable(
  "recurrente_checkout_contexts",
  {
    checkoutId: text("checkout_id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    purchaserUserId: uuid("purchaser_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planCode: varchar("plan_code", { length: 20 }).notNull().default("PRO"),
    attributionId: text("attribution_id"),
    marketingContext: jsonb("marketing_context")
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  (table) => [
    index("idx_recurrente_checkout_contexts_tenant").on(table.tenantId),
    check(
      "recurrente_checkout_contexts_plan_code_check",
      sql`${table.planCode} IN ('FREE', 'PRO', 'BUSINESS')`,
    ),
  ],
);
