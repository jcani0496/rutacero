import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    role: varchar("role", { length: 30 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    userId: uuid("user_id"),
    passwordHash: varchar("password_hash", { length: 255 }),
    displayName: varchar("display_name", { length: 100 }),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    passwordRotatedAt: timestamp("password_rotated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    mustRotatePassword: boolean("must_rotate_password")
      .notNull()
      .default(false),
    /** When false, password-only login is allowed even if ADMIN_MFA_TOTP_SECRET is set. */
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  },
  (table) => [
    index("idx_admin_users_email").on(table.email),
    index("idx_admin_users_password_rotation").on(table.passwordRotatedAt),
    check(
      "admin_users_role_check",
      sql`${table.role} IN ('SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'ANALYST')`,
    ),
    check(
      "admin_users_status_check",
      sql`${table.status} IN ('ACTIVE', 'INACTIVE')`,
    ),
  ],
);

export const adminNotifications = pgTable(
  "admin_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message"),
    read: boolean("read").default(false),
    adminId: uuid("admin_id").references(() => adminUsers.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  },
  (table) => [
    index("idx_admin_notifications_created").on(table.createdAt.desc()),
    index("idx_admin_notifications_unread")
      .on(table.adminId, table.read)
      .where(sql`${table.read} = false`),
    check(
      "admin_notifications_type_check",
      sql`${table.type} IN ('NEW_USER', 'NEW_SUBSCRIPTION', 'SYSTEM_ALERT', 'EXPORT_COMPLETED')`,
    ),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: varchar("entity_id", { length: 255 }).notNull(),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    ip: varchar("ip", { length: 45 }).notNull().default(""),
    userAgent: text("user_agent").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    adminId: uuid("admin_id"),
    details: jsonb("details"),
  },
  (table) => [
    index("idx_audit_logs_admin_user_id").on(table.adminUserId),
    index("idx_audit_logs_admin").on(table.adminId),
    index("idx_audit_logs_action").on(table.action),
    index("idx_audit_logs_entity").on(table.entityType, table.entityId),
    index("idx_audit_logs_created").on(table.createdAt.desc()),
  ],
);

export const adminSavedViews = pgTable(
  "admin_saved_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    filters: jsonb("filters").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_admin_saved_views_admin").on(table.adminId)],
);

export const featureFlags = pgTable(
  "feature_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 100 }).notNull().unique(),
    status: varchar("status", { length: 20 }).notNull().default("DISABLED"),
    rules: jsonb("rules").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "feature_flags_status_check",
      sql`${table.status} IN ('ENABLED', 'DISABLED')`,
    ),
  ],
);
