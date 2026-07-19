import { sql } from "drizzle-orm";
import {
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

export const marketingFunnelEvents = pgTable(
  "marketing_funnel_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    email: text("email"),
    eventName: text("event_name").notNull(),
    attributionId: text("attribution_id").notNull(),
    source: text("source"),
    medium: text("medium"),
    campaignId: text("campaign_id"),
    campaignName: text("campaign_name"),
    creativeId: text("creative_id"),
    creativeName: text("creative_name"),
    partnerSlug: text("partner_slug"),
    referralCode: text("referral_code"),
    landingVariant: text("landing_variant"),
    offerVariant: text("offer_variant"),
    ctaContext: text("cta_context"),
    path: text("path"),
    planStrategy: text("plan_strategy"),
    dedupeKey: text("dedupe_key"),
    firstTouch: jsonb("first_touch").notNull().default(sql`'{}'::jsonb`),
    lastTouch: jsonb("last_touch").notNull().default(sql`'{}'::jsonb`),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  },
  (table) => [
    index("idx_marketing_funnel_events_occurred").on(
      table.eventName,
      table.occurredAt.desc(),
    ),
    index("idx_marketing_funnel_events_attribution").on(
      table.attributionId,
      table.occurredAt.desc(),
    ),
    uniqueIndex("idx_marketing_funnel_events_dedupe")
      .on(table.dedupeKey)
      .where(sql`${table.dedupeKey} IS NOT NULL`),
    index("idx_marketing_funnel_events_slice_dims").on(
      table.source,
      table.medium,
      table.partnerSlug,
      table.landingVariant,
      table.offerVariant,
      table.ctaContext,
    ),
    check(
      "marketing_funnel_events_event_name_check",
      sql`${table.eventName} IN ('landing_viewed', 'signup_started', 'email_verified', 'onboarding_completed', 'first_debt_added', 'first_plan_generated', 'pricing_viewed', 'checkout_started', 'payment_succeeded', 'payment_failed', 'failed_payment_recovered', 'subscription_activated', 'subscription_canceled', 'dropoff_reported')`,
    ),
    check(
      "marketing_funnel_events_attribution_id_check",
      sql`char_length(${table.attributionId}) > 0 AND char_length(${table.attributionId}) <= 120`,
    ),
  ],
);

export const marketingDropoffEvents = pgTable(
  "marketing_dropoff_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    surface: text("surface").notNull(),
    reason: text("reason").notNull(),
    detail: text("detail"),
    email: text("email"),
    path: text("path"),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  },
  (table) => [
    index("idx_marketing_dropoff_events_surface_created").on(
      table.surface,
      table.createdAt.desc(),
    ),
    index("idx_marketing_dropoff_events_user").on(
      table.userId,
      table.createdAt.desc(),
    ),
    check(
      "marketing_dropoff_events_surface_check",
      sql`${table.surface} IN ('landing', 'pricing', 'signup', 'checkout', 'paywall', 'plan')`,
    ),
    check(
      "marketing_dropoff_events_reason_check",
      sql`char_length(${table.reason}) > 0 AND char_length(${table.reason}) <= 120`,
    ),
  ],
);
