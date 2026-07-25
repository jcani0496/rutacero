import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { adminUsers } from "./admin";

// Enums kept from Supabase. Only the three actually referenced by columns
// are ported; subscription_plan / subscription_status / ticket_status were
// orphaned in the final schema (columns use varchar + CHECK) and are dropped.
export const adminRoleEnum = pgEnum("admin_role", [
  "SUPER_ADMIN",
  "ADMIN",
  "SUPPORT",
  "ANALYST",
]);

export const ticketCategoryEnum = pgEnum("ticket_category", [
  "TECHNICAL",
  "BILLING",
  "ACCOUNT",
  "FEATURE_REQUEST",
  "OTHER",
]);

export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]);

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByAdminId: uuid("created_by_admin_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
    assignedToAdminId: uuid("assigned_to_admin_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
    status: varchar("status", { length: 20 }).notNull().default("OPEN"),
    category: varchar("category", { length: 50 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    assignedAdminId: uuid("assigned_admin_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    priority: varchar("priority", { length: 20 }).notNull().default("MEDIUM"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    tenantId: uuid("tenant_id"),
  },
  (table) => [
    index("idx_support_tickets_user").on(table.userId),
    index("idx_support_tickets_status").on(table.status),
    index("idx_support_tickets_assigned").on(table.assignedAdminId),
    check(
      "support_tickets_status_check",
      // App + Supabase enum use WAITING_USER; keep WAITING for older backups.
      sql`${table.status} IN ('OPEN', 'IN_PROGRESS', 'WAITING', 'WAITING_USER', 'RESOLVED', 'CLOSED')`,
    ),
    check(
      "support_tickets_category_check",
      sql`${table.category} IN ('BILLING', 'ACCESS', 'BUG', 'DATA', 'FEATURE_REQUEST', 'OTHER', 'TECHNICAL', 'ACCOUNT')`,
    ),
  ],
);

export const ticketMessages = pgTable(
  "ticket_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    senderType: varchar("sender_type", { length: 10 }).notNull(),
    senderId: uuid("sender_id").notNull(),
    message: text("message").notNull(),
    isInternal: boolean("is_internal").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    tenantId: uuid("tenant_id"),
  },
  (table) => [
    index("idx_ticket_messages_ticket").on(table.ticketId),
    check(
      "ticket_messages_sender_type_check",
      sql`${table.senderType} IN ('USER', 'ADMIN')`,
    ),
  ],
);

export const supportTicketLabels = pgTable(
  "support_ticket_labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    createdBy: uuid("created_by").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_support_ticket_labels_ticket").on(table.ticketId),
    uniqueIndex("idx_support_ticket_labels_unique").on(
      table.ticketId,
      table.label,
    ),
  ],
);

export const adminReplyTemplates = pgTable(
  "admin_reply_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_admin_reply_templates_active").on(table.isActive),
    index("idx_admin_reply_templates_created_by").on(table.createdBy),
  ],
);

export const adminSupportSettings = pgTable(
  "admin_support_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    autoAssignEnabled: boolean("auto_assign_enabled").notNull().default(false),
    autoAssignStrategy: text("auto_assign_strategy")
      .notNull()
      .default("LOAD_BALANCED"),
    autoAssignPriorities: text("auto_assign_priorities")
      .array()
      .notNull()
      .default(sql`ARRAY['URGENT'::text, 'HIGH'::text, 'MEDIUM'::text, 'LOW'::text]`),
    lastRoundRobinIndex: integer("last_round_robin_index")
      .notNull()
      .default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    slaEscalationEnabled: boolean("sla_escalation_enabled")
      .notNull()
      .default(false),
    staleReassignEnabled: boolean("stale_reassign_enabled")
      .notNull()
      .default(false),
    staleReassignHours: integer("stale_reassign_hours").notNull().default(24),
  },
  (table) => [
    index("idx_admin_support_settings_updated").on(table.updatedAt.desc()),
    check(
      "admin_support_settings_auto_assign_strategy_check",
      sql`${table.autoAssignStrategy} IN ('LOAD_BALANCED', 'ROUND_ROBIN')`,
    ),
  ],
);

export const adminSupportRules = pgTable(
  "admin_support_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    category: ticketCategoryEnum("category").notNull(),
    planCode: text("plan_code"),
    setPriority: ticketPriorityEnum("set_priority"),
    assignRole: adminRoleEnum("assign_role"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_admin_support_rules_category").on(
      table.category,
      table.isActive,
    ),
    index("idx_admin_support_rules_plan").on(table.planCode),
  ],
);
