import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  inet,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { tenants } from "./tenants";

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    currencyBase: varchar("currency_base", { length: 3 })
      .notNull()
      .default("GTQ"),
    payFrequency: varchar("pay_frequency", { length: 20 })
      .notNull()
      .default("BIWEEKLY"),
    payDates: integer("pay_dates")
      .array()
      .notNull()
      .default(sql`ARRAY[15, 30]`),
    goalType: varchar("goal_type", { length: 20 }).notNull().default("BALANCED"),
    timezone: varchar("timezone", { length: 50 })
      .notNull()
      .default("America/Guatemala"),
    onboardingCompleted: boolean("onboarding_completed")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    currentTenantId: uuid("current_tenant_id").references(() => tenants.id),
    motivationLevel: integer("motivation_level").notNull().default(3),
    riskTolerance: integer("risk_tolerance").notNull().default(3),
    safetyBufferPct: numeric("safety_buffer_pct").notNull().default("10"),
    onboardingMotivation: text("onboarding_motivation"),
  },
  (table) => [
    index("idx_user_profiles_created_at").on(table.createdAt.desc()),
    index("idx_user_profiles_last_active").on(
      table.lastActiveAt.desc().nullsLast(),
    ),
    check(
      "user_profiles_currency_base_check",
      sql`${table.currencyBase} IN ('GTQ', 'USD')`,
    ),
    check(
      "user_profiles_goal_type_check",
      sql`${table.goalType} IN ('FASTEST', 'LEAST_INTEREST', 'BALANCED')`,
    ),
    check(
      "user_profiles_pay_frequency_check",
      sql`${table.payFrequency} IN ('BIWEEKLY', 'MONTHLY', 'VARIABLE')`,
    ),
    check(
      "user_profiles_motivation_level_check",
      sql`${table.motivationLevel} >= 1 AND ${table.motivationLevel} <= 5`,
    ),
    check(
      "user_profiles_risk_tolerance_check",
      sql`${table.riskTolerance} >= 1 AND ${table.riskTolerance} <= 5`,
    ),
    check(
      "user_profiles_safety_buffer_pct_check",
      sql`${table.safetyBufferPct} >= 0 AND ${table.safetyBufferPct} <= 50`,
    ),
    check(
      "user_profiles_onboarding_motivation_check",
      sql`${table.onboardingMotivation} IS NULL OR ${table.onboardingMotivation} IN ('STRESSED', 'SAVE_INTEREST', 'BIG_PURCHASE', 'UNDERSTAND_NUMBERS')`,
    ),
  ],
);

export const accountDeletionRequests = pgTable(
  "account_deletion_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    executesAt: timestamp("executes_at", { withTimezone: true }).notNull(),
    // Migration 048: failed execution attempts, retried by the daily cron
    // while below its cap; rows at the cap need manual follow-up.
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_deletion_requests_pending_executes")
      .on(table.executesAt)
      .where(sql`${table.canceledAt} IS NULL AND ${table.executedAt} IS NULL`),
    index("idx_deletion_requests_user")
      .on(table.userId)
      .where(sql`${table.canceledAt} IS NULL AND ${table.executedAt} IS NULL`),
    uniqueIndex("uq_deletion_requests_active_per_user")
      .on(table.userId)
      .where(sql`${table.canceledAt} IS NULL AND ${table.executedAt} IS NULL`),
  ],
);

export const userConsentLog = pgTable(
  "user_consent_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentType: text("document_type").notNull(),
    version: text("version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
  },
  (table) => [
    index("idx_user_consent_log_user_doc").on(table.userId, table.documentType),
    check(
      "user_consent_log_document_type_check",
      sql`${table.documentType} IN ('tos', 'privacy', 'financial_disclaimer', 'cookies')`,
    ),
  ],
);
