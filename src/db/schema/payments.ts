import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { debts } from "./debts";
import { adminUsers } from "./admin";

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    debtId: uuid("debt_id")
      .notNull()
      .references(() => debts.id, { onDelete: "cascade" }),
    amount: numeric("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("GTQ"),
    paymentDate: date("payment_date").notNull(),
    method: varchar("method", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    tenantId: uuid("tenant_id").notNull(),
    receiptUrl: text("receipt_url"),
    receiptUploadedAt: timestamp("receipt_uploaded_at", {
      withTimezone: true,
    }),
  },
  (table) => [
    index("idx_payments_user_id").on(table.userId),
    index("idx_payments_debt_id").on(table.debtId),
    index("idx_payments_date").on(table.paymentDate),
    index("idx_payments_tenant_user").on(table.tenantId, table.userId),
    index("idx_payments_user_date").on(table.userId, table.paymentDate.desc()),
    index("idx_payments_debt").on(table.debtId, table.paymentDate.desc()),
    check("payments_amount_check", sql`${table.amount} > 0`),
    check(
      "payments_currency_check",
      sql`${table.currency} IN ('GTQ', 'USD')`,
    ),
  ],
);

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    strategy: varchar("strategy", { length: 20 }).notNull(),
    engineVersion: varchar("engine_version", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    active: boolean("active").notNull().default(false),
    assumptions: jsonb("assumptions").notNull().default(sql`'{}'::jsonb`),
    horizonPeriods: integer("horizon_periods").notNull().default(8),
    etaDebtFree: date("eta_debt_free").notNull(),
    interestEstimate: numeric("interest_estimate").notNull().default("0"),
    avgPayment: numeric("avg_payment").notNull().default("0"),
    tenantId: uuid("tenant_id").notNull(),
  },
  (table) => [
    index("idx_plans_user_id").on(table.userId),
    index("idx_plans_active").on(table.active),
    index("idx_plans_tenant_user").on(table.tenantId, table.userId),
    check(
      "plans_strategy_check",
      sql`${table.strategy} IN ('AVALANCHE', 'SNOWBALL', 'HYBRID')`,
    ),
  ],
);

export const planItems = pgTable(
  "plan_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    debtId: uuid("debt_id")
      .notNull()
      .references(() => debts.id, { onDelete: "cascade" }),
    plannedAmount: numeric("planned_amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("GTQ"),
    priorityOrder: integer("priority_order").notNull(),
    isFocus: boolean("is_focus").notNull().default(false),
    rationale: jsonb("rationale").notNull().default(sql`'{}'::jsonb`),
    tenantId: uuid("tenant_id").notNull(),
  },
  (table) => [
    index("idx_plan_items_plan_id").on(table.planId),
    check("plan_items_planned_amount_check", sql`${table.plannedAmount} >= 0`),
    check(
      "plan_items_currency_check",
      sql`${table.currency} IN ('GTQ', 'USD')`,
    ),
  ],
);

export const forecasts = pgTable(
  "forecasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    engineVersion: varchar("engine_version", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    horizonPeriods: integer("horizon_periods").notNull().default(8),
    periods: jsonb("periods").notNull().default(sql`'[]'::jsonb`),
    maeLastPeriod: numeric("mae_last_period"),
    tenantId: uuid("tenant_id").notNull(),
  },
  (table) => [index("idx_forecasts_user_id").on(table.userId)],
);

export const engineConfigs = pgTable(
  "engine_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    version: varchar("version", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("DRAFT"),
    weights: jsonb("weights")
      .notNull()
      .default(
        sql`'{"w_rate": 0.30, "w_balance": 0.30, "w_due": 0.15, "w_momentum": 0.15, "w_type": 0.10}'::jsonb`,
      ),
    constraints: jsonb("constraints")
      .notNull()
      .default(
        sql`'{"max_apr_cap": 80, "min_cash_buffer": 0, "urgency_window_days": 7, "max_simulation_periods": 600}'::jsonb`,
      ),
    createdByAdminId: uuid("created_by_admin_id")
      .notNull()
      .references(() => adminUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
  },
  (table) => [
    unique("engine_configs_version_key").on(table.version),
    check(
      "engine_configs_status_check",
      sql`${table.status} IN ('DRAFT', 'ACTIVE', 'ARCHIVED')`,
    ),
  ],
);

export const paymentWebhookEvents = pgTable(
  "payment_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: varchar("provider", { length: 50 }).notNull(),
    externalEventId: varchar("external_event_id", { length: 255 }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    payload: jsonb("payload").notNull(),
    processed: boolean("processed").notNull().default(false),
    error: text("error"),
  },
  (table) => [
    unique("payment_webhook_events_provider_external_event_id_key").on(
      table.provider,
      table.externalEventId,
    ),
  ],
);
