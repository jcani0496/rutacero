import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export const debts = pgTable(
  "debts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).notNull(),
    creditor: varchar("creditor", { length: 255 }).notNull(),
    balance: numeric("balance").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("GTQ"),
    apr: numeric("apr"),
    minPayment: numeric("min_payment").notNull().default("0"),
    statementDate: integer("statement_date"),
    dueDate: integer("due_date"),
    nextPaymentDate: date("next_payment_date").notNull(),
    installmentCount: integer("installment_count"),
    installmentsLeft: integer("installments_left"),
    fixedPayment: numeric("fixed_payment"),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    goalExtraPayment: numeric("goal_extra_payment").notNull().default("0"),
    goalTargetDate: date("goal_target_date"),
    category: varchar("category", { length: 50 }),
    tenantId: uuid("tenant_id").notNull(),
    interestModel: text("interest_model"),
    paymentDay: integer("payment_day"),
    monthlyFees: numeric("monthly_fees").notNull().default("0"),
    minPaymentRule: jsonb("min_payment_rule"),
    tags: jsonb("tags").default(sql`'[]'::jsonb`),
  },
  (table) => [
    index("idx_debts_user_id").on(table.userId),
    index("idx_debts_status").on(table.status),
    index("idx_debts_created").on(table.createdAt.desc()),
    index("idx_debts_tenant_user").on(table.tenantId, table.userId),
    // Migration 050 intent: full composite (user_id, status) so the admin
    // user-list batch (cross-tenant, any status) stops seq-scanning. The 006
    // partial variant (WHERE status='ACTIVE') is subsumed by this one.
    index("idx_debts_user_status").on(table.userId, table.status),
    index("idx_debts_tags").using("gin", table.tags),
    check(
      "debts_type_check",
      sql`${table.type} IN ('CREDIT_CARD', 'LOAN', 'INSTALLMENT', 'INFORMAL')`,
    ),
    check("debts_balance_check", sql`${table.balance} >= 0`),
    check(
      "debts_currency_check",
      sql`${table.currency} IN ('GTQ', 'USD')`,
    ),
    check(
      "debts_apr_check",
      sql`${table.apr} IS NULL OR (${table.apr} >= 0 AND ${table.apr} <= 300)`,
    ),
    check("debts_min_payment_check", sql`${table.minPayment} >= 0`),
    check(
      "debts_statement_date_check",
      sql`${table.statementDate} IS NULL OR (${table.statementDate} >= 1 AND ${table.statementDate} <= 31)`,
    ),
    check(
      "debts_due_date_check",
      sql`${table.dueDate} IS NULL OR (${table.dueDate} >= 1 AND ${table.dueDate} <= 31)`,
    ),
    check(
      "debts_installment_count_check",
      sql`${table.installmentCount} IS NULL OR ${table.installmentCount} > 0`,
    ),
    check(
      "debts_installments_left_check",
      sql`${table.installmentsLeft} IS NULL OR ${table.installmentsLeft} >= 0`,
    ),
    check(
      "debts_fixed_payment_check",
      sql`${table.fixedPayment} IS NULL OR ${table.fixedPayment} >= 0`,
    ),
    check(
      "debts_status_check",
      sql`${table.status} IN ('ACTIVE', 'PAID_OFF', 'RESTRUCTURED', 'DEFAULTED')`,
    ),
    check(
      "debts_interest_model_check",
      sql`${table.interestModel} IS NULL OR ${table.interestModel} IN ('MONTHLY_SIMPLE', 'DAILY_SIMPLE', 'DAILY_AVG_BALANCE')`,
    ),
    check(
      "debts_payment_day_check",
      sql`${table.paymentDay} IS NULL OR (${table.paymentDay} >= 1 AND ${table.paymentDay} <= 31)`,
    ),
    check("debts_monthly_fees_check", sql`${table.monthlyFees} >= 0`),
  ],
);

export const debtDocuments = pgTable(
  "debt_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    debtId: uuid("debt_id")
      .notNull()
      .references(() => debts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileUrl: text("file_url").notNull(),
    fileType: varchar("file_type", { length: 50 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    tenantId: uuid("tenant_id").notNull(),
  },
  (table) => [index("idx_debt_documents_debt_id").on(table.debtId)],
);

export const essentialExpenses = pgTable(
  "essential_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    amount: numeric("amount").notNull(),
    frequency: varchar("frequency", { length: 20 })
      .notNull()
      .default("MONTHLY"),
    nextDate: date("next_date").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("GTQ"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expenseType: varchar("expense_type", { length: 20 }).default("NEED"),
    category: varchar("category", { length: 50 }).default("OTHER"),
    budgetAmount: numeric("budget_amount"),
    actualAmount: numeric("actual_amount").default("0"),
    tenantId: uuid("tenant_id").notNull(),
  },
  (table) => [
    index("idx_essential_expenses_user_id").on(table.userId),
    // Migration 050: covers the Movimientos window query
    // (tenant_id, user_id) + next_date range.
    index("idx_essential_expenses_tenant_user_next_date").on(
      table.tenantId,
      table.userId,
      table.nextDate,
    ),
    check("essential_expenses_amount_check", sql`${table.amount} > 0`),
    check(
      "essential_expenses_currency_check",
      sql`${table.currency} IN ('GTQ', 'USD')`,
    ),
    check(
      "essential_expenses_frequency_check",
      sql`${table.frequency} IN ('MONTHLY', 'BIWEEKLY')`,
    ),
    check(
      "essential_expenses_expense_type_check",
      sql`${table.expenseType} IN ('NEED', 'WANT')`,
    ),
  ],
);

export const incomeEvents = pgTable(
  "income_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    amount: numeric("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("GTQ"),
    type: varchar("type", { length: 20 }).notNull().default("FIXED"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    source: varchar("source", { length: 100 }).default("Salario"),
    tenantId: uuid("tenant_id").notNull(),
  },
  (table) => [
    index("idx_income_events_user_id").on(table.userId),
    index("idx_income_events_date").on(table.date),
    // Migration 050: covers the Movimientos window query
    // (tenant_id, user_id) + date range.
    index("idx_income_events_tenant_user_date").on(
      table.tenantId,
      table.userId,
      table.date,
    ),
    check("income_events_amount_check", sql`${table.amount} > 0`),
    check(
      "income_events_currency_check",
      sql`${table.currency} IN ('GTQ', 'USD')`,
    ),
    check(
      "income_events_type_check",
      sql`${table.type} IN ('FIXED', 'VARIABLE')`,
    ),
  ],
);

export const variableBudgetTargets = pgTable(
  "variable_budget_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 100 }).notNull(),
    amount: numeric("amount").notNull(),
    period: varchar("period", { length: 20 }).notNull().default("MONTHLY"),
    currency: varchar("currency", { length: 3 }).notNull().default("GTQ"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    actualAmount: numeric("actual_amount").notNull().default("0"),
    tenantId: uuid("tenant_id").notNull(),
  },
  (table) => [
    index("idx_variable_budget_targets_user_id").on(table.userId),
    check("variable_budget_targets_amount_check", sql`${table.amount} > 0`),
    check(
      "variable_budget_targets_currency_check",
      sql`${table.currency} IN ('GTQ', 'USD')`,
    ),
    check(
      "variable_budget_targets_period_check",
      sql`${table.period} IN ('MONTHLY', 'BIWEEKLY')`,
    ),
  ],
);

// Legacy note: `alerts` predates user_notifications and is kept because the
// snapshot still has it (0 rows). Type/severity/status checks preserved.
export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 30 }).notNull(),
    severity: varchar("severity", { length: 10 }).notNull(),
    periodStart: date("period_start").notNull(),
    message: text("message").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    tenantId: uuid("tenant_id").notNull(),
  },
  (table) => [
    index("idx_alerts_user_id").on(table.userId),
    index("idx_alerts_status").on(table.status),
    index("idx_alerts_tenant_user").on(table.tenantId, table.userId),
    check(
      "alerts_type_check",
      sql`${table.type} IN ('PAYMENT_DUE', 'INSUFFICIENT_CASH', 'BUDGET_EXCEEDED', 'PLAN_DEVIATION')`,
    ),
    check(
      "alerts_severity_check",
      sql`${table.severity} IN ('LOW', 'MEDIUM', 'HIGH')`,
    ),
    check(
      "alerts_status_check",
      sql`${table.status} IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')`,
    ),
  ],
);
