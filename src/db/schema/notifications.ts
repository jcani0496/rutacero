import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { tenants } from "./tenants";

export const userNotifications = pgTable(
  "user_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    severity: text("severity").notNull().default("INFO"),
    title: text("title").notNull(),
    message: text("message"),
    read: boolean("read").notNull().default(false),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    tenantId: uuid("tenant_id").notNull(),
  },
  (table) => [
    index("idx_user_notifications_user").on(table.userId),
    index("idx_user_notifications_tenant_user").on(
      table.tenantId,
      table.userId,
    ),
    index("idx_user_notifications_unread")
      .on(table.userId, table.read, table.createdAt.desc())
      .where(sql`${table.read} = false`),
    check(
      "user_notifications_type_check",
      sql`${table.type} IN ('PAYMENT_REMINDER', 'PAYMENT_DUE', 'OVERDUE', 'MILESTONE', 'PLAN_NUDGE', 'SYSTEM')`,
    ),
    check(
      "user_notifications_severity_check",
      sql`${table.severity} IN ('INFO', 'WARNING', 'CRITICAL', 'SUCCESS')`,
    ),
  ],
);

export const lifecycleTouchpoints = pgTable(
  "lifecycle_touchpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campaignKey: text("campaign_key").notNull(),
    channel: text("channel").notNull(),
    status: text("status").notNull().default("PENDING"),
    dedupeKey: text("dedupe_key").notNull(),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    triggeredAt: timestamp("triggered_at", { withTimezone: true })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  (table) => [
    index("idx_lifecycle_touchpoints_tenant_user_created").on(
      table.tenantId,
      table.userId,
      table.createdAt.desc(),
    ),
    index("idx_lifecycle_touchpoints_campaign_created").on(
      table.campaignKey,
      table.createdAt.desc(),
    ),
    uniqueIndex("idx_lifecycle_touchpoints_unique_channel").on(
      table.tenantId,
      table.userId,
      table.channel,
      table.dedupeKey,
    ),
    check(
      "lifecycle_touchpoints_campaign_key_check",
      sql`${table.campaignKey} IN ('ONBOARDING_NUDGE', 'FIRST_PLAN_REMINDER', 'WEEKLY_PROGRESS', 'OVERDUE_NUDGE', 'FAILED_PAYMENT_RECOVERY')`,
    ),
    check(
      "lifecycle_touchpoints_channel_check",
      sql`${table.channel} IN ('EMAIL', 'IN_APP')`,
    ),
    check(
      "lifecycle_touchpoints_status_check",
      sql`${table.status} IN ('PENDING', 'SENT', 'SKIPPED', 'FAILED', 'RECOVERED')`,
    ),
    check(
      "lifecycle_touchpoints_dedupe_key_check",
      sql`char_length(${table.dedupeKey}) > 0 AND char_length(${table.dedupeKey}) <= 200`,
    ),
  ],
);
