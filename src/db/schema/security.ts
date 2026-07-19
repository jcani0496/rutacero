import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Progressive login lockout state (migration 029). Keyed by
 * (channel, principal) where principal is an email (user channel) or admin
 * email (admin channel). App-layer auth consults this before password checks.
 */
export const authLoginLockouts = pgTable(
  "auth_login_lockouts",
  {
    channel: text("channel").notNull(),
    principal: text("principal").notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockLevel: integer("lock_level").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastFailedAt: timestamp("last_failed_at", { withTimezone: true }),
    lastIp: text("last_ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.channel, table.principal] }),
    index("idx_auth_login_lockouts_locked_until")
      .on(table.lockedUntil)
      .where(sql`${table.lockedUntil} IS NOT NULL`),
    check(
      "auth_login_lockouts_channel_check",
      sql`${table.channel} IN ('user', 'admin')`,
    ),
    check(
      "auth_login_lockouts_failed_attempts_check",
      sql`${table.failedAttempts} >= 0`,
    ),
    check(
      "auth_login_lockouts_lock_level_check",
      sql`${table.lockLevel} >= 0`,
    ),
  ],
);
