/**
 * Drizzle data-access helpers for the funnel/billing domain (F3g).
 * Callers branch with isDrizzleEnabled() and keep the PostgREST path as default.
 */
import { and, eq, gte, sql } from "drizzle-orm";

import { getDb, type Db } from "@/db/client";
import {
  billingEntitlements,
  debts,
  marketingFunnelEvents,
  manualPaymentGrants,
  paymentWebhookEvents,
  pendingManualTransfers,
  plans,
  recurrenteCheckoutContexts,
  subscriptions,
  tenants,
} from "@/db/schema";
import {
  mapBillingEntitlementRow,
  mapPaymentWebhookEventRow,
  mapRecurrenteCheckoutContextRow,
  mapSubscriptionRow,
  type BillingEntitlementMapped,
  type PaymentWebhookEventMapped,
  type RecurrenteCheckoutContextMapped,
  type SubscriptionMapped,
} from "@/lib/data/mappers";

function db(): Db {
  return getDb();
}

function isUniqueViolation(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function asJsonb(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export async function drizzleFindSubscriptionByExternalId(
  externalId: string,
): Promise<SubscriptionMapped | null> {
  const rows = await db()
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.externalId, externalId))
    .limit(1);
  return rows[0] ? mapSubscriptionRow(rows[0]) : null;
}

export async function drizzleFindSubscriptionByTenantId(
  tenantId: string,
): Promise<SubscriptionMapped | null> {
  const rows = await db()
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);
  return rows[0] ? mapSubscriptionRow(rows[0]) : null;
}

export async function drizzleFindActiveSubscriptionByTenantId(
  tenantId: string,
): Promise<SubscriptionMapped | null> {
  const rows = await db()
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.status, "ACTIVE"),
      ),
    )
    .limit(1);
  return rows[0] ? mapSubscriptionRow(rows[0]) : null;
}

export async function drizzleFindStoredSubscription(input: {
  tenantId?: string | null;
  subscriptionId?: string | null;
}): Promise<SubscriptionMapped | null> {
  if (input.subscriptionId) {
    const byExternal = await drizzleFindSubscriptionByExternalId(
      input.subscriptionId,
    );
    if (byExternal) return byExternal;
  }
  if (input.tenantId) {
    return drizzleFindSubscriptionByTenantId(input.tenantId);
  }
  return null;
}

export type SubscriptionUpsertValues = {
  tenantId: string;
  userId: string;
  purchaserUserId?: string | null;
  planCode?: string;
  status?: string;
  provider?: string;
  externalId?: string | null;
  startAt?: Date | string;
  renewAt?: Date | string | null;
  cancelAt?: Date | string | null;
  billingInterval?: string;
  paymentMethod?: string;
  priceAmountQ?: string | number | null;
  attributionId?: string | null;
  marketingContext?: unknown;
};

function toTimestamp(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value : new Date(value);
}

export async function drizzleUpsertSubscriptionByTenant(
  values: SubscriptionUpsertValues,
): Promise<void> {
  const now = new Date();
  const insertValues = {
    tenantId: values.tenantId,
    userId: values.userId,
    purchaserUserId: values.purchaserUserId ?? values.userId,
    planCode: values.planCode ?? "FREE",
    status: values.status ?? "ACTIVE",
    provider: values.provider ?? "recurrente",
    externalId: values.externalId ?? null,
    startAt: toTimestamp(values.startAt) ?? now,
    renewAt: toTimestamp(values.renewAt ?? null),
    cancelAt: toTimestamp(values.cancelAt ?? null),
    billingInterval: values.billingInterval ?? "monthly",
    paymentMethod: values.paymentMethod ?? "recurrente",
    priceAmountQ:
      values.priceAmountQ === null || values.priceAmountQ === undefined
        ? null
        : String(values.priceAmountQ),
    attributionId: values.attributionId ?? null,
    marketingContext: asJsonb(values.marketingContext),
    updatedAt: now,
  };

  const updateSet: Record<string, unknown> = { updatedAt: now };
  if (values.purchaserUserId !== undefined) {
    updateSet.purchaserUserId = values.purchaserUserId;
  }
  if (values.userId !== undefined) updateSet.userId = values.userId;
  if (values.planCode !== undefined) updateSet.planCode = values.planCode;
  if (values.status !== undefined) updateSet.status = values.status;
  if (values.provider !== undefined) updateSet.provider = values.provider;
  if (values.externalId !== undefined) updateSet.externalId = values.externalId;
  if (values.startAt !== undefined) {
    updateSet.startAt = toTimestamp(values.startAt) ?? now;
  }
  if (values.renewAt !== undefined) {
    updateSet.renewAt = toTimestamp(values.renewAt);
  }
  if (values.cancelAt !== undefined) {
    updateSet.cancelAt = toTimestamp(values.cancelAt);
  }
  if (values.billingInterval !== undefined) {
    updateSet.billingInterval = values.billingInterval;
  }
  if (values.paymentMethod !== undefined) {
    updateSet.paymentMethod = values.paymentMethod;
  }
  if (values.priceAmountQ !== undefined) {
    updateSet.priceAmountQ =
      values.priceAmountQ === null ? null : String(values.priceAmountQ);
  }
  if (values.attributionId !== undefined) {
    updateSet.attributionId = values.attributionId;
  }
  if (values.marketingContext !== undefined) {
    updateSet.marketingContext = asJsonb(values.marketingContext);
  }

  await db()
    .insert(subscriptions)
    .values(insertValues)
    .onConflictDoUpdate({
      target: subscriptions.tenantId,
      set: updateSet,
    });
}

export async function drizzleUpdateSubscriptionByTenant(
  tenantId: string,
  updates: Partial<{
    status: string;
    planCode: string;
    cancelAt: Date | string | null;
    renewAt: Date | string | null;
    provider: string;
  }>,
): Promise<void> {
  await db()
    .update(subscriptions)
    .set({
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.planCode !== undefined ? { planCode: updates.planCode } : {}),
      ...(updates.cancelAt !== undefined
        ? { cancelAt: toTimestamp(updates.cancelAt) }
        : {}),
      ...(updates.renewAt !== undefined
        ? { renewAt: toTimestamp(updates.renewAt) }
        : {}),
      ...(updates.provider !== undefined ? { provider: updates.provider } : {}),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.tenantId, tenantId));
}

export async function drizzleUpdateSubscriptionByExternalId(
  externalId: string,
  updates: Partial<{
    status: string;
    planCode: string;
    cancelAt: Date | string | null;
  }>,
): Promise<void> {
  await db()
    .update(subscriptions)
    .set({
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.planCode !== undefined ? { planCode: updates.planCode } : {}),
      ...(updates.cancelAt !== undefined
        ? { cancelAt: toTimestamp(updates.cancelAt) }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.externalId, externalId));
}

// ---------------------------------------------------------------------------
// Checkout contexts
// ---------------------------------------------------------------------------

export async function drizzleFindCheckoutContext(
  checkoutId: string,
): Promise<RecurrenteCheckoutContextMapped | null> {
  const rows = await db()
    .select()
    .from(recurrenteCheckoutContexts)
    .where(eq(recurrenteCheckoutContexts.checkoutId, checkoutId))
    .limit(1);
  return rows[0] ? mapRecurrenteCheckoutContextRow(rows[0]) : null;
}

export async function drizzleUpsertCheckoutContext(values: {
  checkoutId: string;
  tenantId: string;
  purchaserUserId: string;
  planCode: string;
  attributionId: string | null;
  marketingContext: unknown;
}): Promise<void> {
  await db()
    .insert(recurrenteCheckoutContexts)
    .values({
      checkoutId: values.checkoutId,
      tenantId: values.tenantId,
      purchaserUserId: values.purchaserUserId,
      planCode: values.planCode,
      attributionId: values.attributionId,
      marketingContext: asJsonb(values.marketingContext),
    })
    .onConflictDoUpdate({
      target: recurrenteCheckoutContexts.checkoutId,
      set: {
        tenantId: values.tenantId,
        purchaserUserId: values.purchaserUserId,
        planCode: values.planCode,
        attributionId: values.attributionId,
        marketingContext: asJsonb(values.marketingContext),
      },
    });
}

// ---------------------------------------------------------------------------
// Webhook idempotency
// ---------------------------------------------------------------------------

export type WebhookInsertResult =
  | { kind: "inserted" }
  | { kind: "duplicate"; processed: boolean };

export async function drizzleInsertWebhookEvent(input: {
  provider: string;
  externalEventId: string;
  payload: unknown;
}): Promise<WebhookInsertResult> {
  try {
    await db().insert(paymentWebhookEvents).values({
      provider: input.provider,
      externalEventId: input.externalEventId,
      payload: input.payload as Record<string, unknown>,
      processed: false,
    });
    return { kind: "inserted" };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await drizzleGetWebhookProcessed(
      input.provider,
      input.externalEventId,
    );
    return {
      kind: "duplicate",
      processed: existing?.processed ?? false,
    };
  }
}

export async function drizzleGetWebhookProcessed(
  provider: string,
  externalEventId: string,
): Promise<Pick<PaymentWebhookEventMapped, "processed"> | null> {
  const rows = await db()
    .select({ processed: paymentWebhookEvents.processed })
    .from(paymentWebhookEvents)
    .where(
      and(
        eq(paymentWebhookEvents.provider, provider),
        eq(paymentWebhookEvents.externalEventId, externalEventId),
      ),
    )
    .limit(1);
  if (!rows[0]) return null;
  return { processed: Boolean(rows[0].processed) };
}

export async function drizzleMarkWebhookProcessed(
  provider: string,
  externalEventId: string,
  error: string | null = null,
): Promise<void> {
  await db()
    .update(paymentWebhookEvents)
    .set({
      processed: error === null,
      error,
    })
    .where(
      and(
        eq(paymentWebhookEvents.provider, provider),
        eq(paymentWebhookEvents.externalEventId, externalEventId),
      ),
    );
}

export async function drizzleCleanupProcessedWebhookEvents(
  cutoff: Date,
): Promise<number> {
  const deleted = await db()
    .delete(paymentWebhookEvents)
    .where(
      and(
        eq(paymentWebhookEvents.processed, true),
        sql`${paymentWebhookEvents.receivedAt} < ${cutoff}`,
      ),
    )
    .returning({ id: paymentWebhookEvents.id });
  return deleted.length;
}

// ---------------------------------------------------------------------------
// Billing entitlements (Google Play)
// ---------------------------------------------------------------------------

export async function drizzleFindBillingEntitlementByToken(
  provider: string,
  purchaseToken: string,
): Promise<BillingEntitlementMapped | null> {
  const rows = await db()
    .select()
    .from(billingEntitlements)
    .where(
      and(
        eq(billingEntitlements.provider, provider),
        eq(billingEntitlements.purchaseToken, purchaseToken),
      ),
    )
    .limit(1);
  return rows[0] ? mapBillingEntitlementRow(rows[0]) : null;
}

export async function drizzleUpsertBillingEntitlement(values: {
  tenantId: string;
  userId: string;
  provider: string;
  platform: string;
  productId: string;
  purchaseToken: string;
  orderId: string | null;
  status: string;
  grantedAt: Date | string;
  expiresAt: Date | string | null;
  lastVerifiedAt: Date | string;
  rawResponse: unknown;
}): Promise<void> {
  const now = new Date();
  await db()
    .insert(billingEntitlements)
    .values({
      tenantId: values.tenantId,
      userId: values.userId,
      provider: values.provider,
      platform: values.platform,
      productId: values.productId,
      purchaseToken: values.purchaseToken,
      orderId: values.orderId,
      status: values.status,
      grantedAt: toTimestamp(values.grantedAt) ?? now,
      expiresAt: toTimestamp(values.expiresAt),
      lastVerifiedAt: toTimestamp(values.lastVerifiedAt) ?? now,
      rawResponse: asJsonb(values.rawResponse),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        billingEntitlements.provider,
        billingEntitlements.purchaseToken,
      ],
      set: {
        tenantId: values.tenantId,
        userId: values.userId,
        platform: values.platform,
        productId: values.productId,
        orderId: values.orderId,
        status: values.status,
        grantedAt: toTimestamp(values.grantedAt) ?? now,
        expiresAt: toTimestamp(values.expiresAt),
        lastVerifiedAt: toTimestamp(values.lastVerifiedAt) ?? now,
        rawResponse: asJsonb(values.rawResponse),
        updatedAt: now,
      },
    });
}

// ---------------------------------------------------------------------------
// Manual grants / pending transfers
// ---------------------------------------------------------------------------

export async function drizzleGetTenantOwnerUserId(
  tenantId: string,
): Promise<string | null> {
  const rows = await db()
    .select({ createdByUserId: tenants.createdByUserId })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return rows[0]?.createdByUserId ?? null;
}

export async function drizzleInsertManualPaymentGrant(values: {
  tenantId: string;
  grantedByAdminId: string;
  variantCode: string;
  priceAmountQ: number;
  bankReference: string;
  durationDays: number;
  expiresAt: Date | string;
  notes: string | null;
}): Promise<void> {
  await db().insert(manualPaymentGrants).values({
    tenantId: values.tenantId,
    grantedByAdminId: values.grantedByAdminId,
    variantCode: values.variantCode,
    priceAmountQ: String(values.priceAmountQ),
    bankReference: values.bankReference,
    durationDays: values.durationDays,
    expiresAt: toTimestamp(values.expiresAt) ?? new Date(),
    notes: values.notes,
  });
}

export async function drizzleDeleteManualPaymentGrant(input: {
  tenantId: string;
  grantedByAdminId: string;
  expiresAtIso: string;
}): Promise<void> {
  await db()
    .delete(manualPaymentGrants)
    .where(
      and(
        eq(manualPaymentGrants.tenantId, input.tenantId),
        eq(manualPaymentGrants.grantedByAdminId, input.grantedByAdminId),
        eq(manualPaymentGrants.expiresAt, new Date(input.expiresAtIso)),
      ),
    );
}

export async function drizzleInsertPendingManualTransfer(values: {
  tenantId: string;
  userId: string;
  variantCode: string;
  referenceCode: string;
  expiresAt: Date | string;
}): Promise<void> {
  await db().insert(pendingManualTransfers).values({
    tenantId: values.tenantId,
    userId: values.userId,
    variantCode: values.variantCode,
    referenceCode: values.referenceCode,
    expiresAt: toTimestamp(values.expiresAt) ?? new Date(),
  });
}

// ---------------------------------------------------------------------------
// Plans (strategy lookup for checkout attribution)
// ---------------------------------------------------------------------------

export async function drizzleGetActivePlanStrategy(
  tenantId: string,
  userId: string,
): Promise<string | null> {
  const rows = await db()
    .select({ strategy: plans.strategy })
    .from(plans)
    .where(
      and(
        eq(plans.tenantId, tenantId),
        eq(plans.userId, userId),
        eq(plans.active, true),
      ),
    )
    .limit(1);
  return rows[0]?.strategy ?? null;
}

// ---------------------------------------------------------------------------
// Marketing funnel events
// ---------------------------------------------------------------------------

export async function drizzleInsertMarketingFunnelEvent(values: {
  tenantId?: string | null;
  userId?: string | null;
  email?: string | null;
  eventName: string;
  occurredAt?: Date | string;
  attributionId: string;
  source?: string | null;
  medium?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  creativeId?: string | null;
  creativeName?: string | null;
  partnerSlug?: string | null;
  referralCode?: string | null;
  landingVariant?: string | null;
  offerVariant?: string | null;
  ctaContext?: string | null;
  path?: string | null;
  planStrategy?: string | null;
  dedupeKey?: string | null;
  firstTouch?: unknown;
  lastTouch?: unknown;
  metadata?: unknown;
}): Promise<void> {
  try {
    await db().insert(marketingFunnelEvents).values({
      tenantId: values.tenantId ?? null,
      userId: values.userId ?? null,
      email: values.email ?? null,
      eventName: values.eventName,
      occurredAt: toTimestamp(values.occurredAt) ?? new Date(),
      attributionId: values.attributionId,
      source: values.source ?? null,
      medium: values.medium ?? null,
      campaignId: values.campaignId ?? null,
      campaignName: values.campaignName ?? null,
      creativeId: values.creativeId ?? null,
      creativeName: values.creativeName ?? null,
      partnerSlug: values.partnerSlug ?? null,
      referralCode: values.referralCode ?? null,
      landingVariant: values.landingVariant ?? null,
      offerVariant: values.offerVariant ?? null,
      ctaContext: values.ctaContext ?? null,
      path: values.path ?? null,
      planStrategy: values.planStrategy ?? null,
      dedupeKey: values.dedupeKey ?? null,
      firstTouch: asJsonb(values.firstTouch),
      lastTouch: asJsonb(values.lastTouch),
      metadata: asJsonb(values.metadata),
    });
  } catch (error) {
    // Dedupe unique index: concurrent/retry inserts are best-effort no-ops.
    if (isUniqueViolation(error)) return;
    throw error;
  }
}

export async function drizzleListMarketingEventNamesSince(
  since: Date,
): Promise<Array<{ event_name: string }>> {
  const rows = await db()
    .select({ eventName: marketingFunnelEvents.eventName })
    .from(marketingFunnelEvents)
    .where(gte(marketingFunnelEvents.occurredAt, since));
  return rows.map((row) => ({ event_name: row.eventName }));
}

// ---------------------------------------------------------------------------
// Feature access helpers
// ---------------------------------------------------------------------------

export async function drizzleCountActiveDebts(
  tenantId: string,
  userId: string,
): Promise<number> {
  const [row] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(debts)
    .where(
      and(
        eq(debts.tenantId, tenantId),
        eq(debts.userId, userId),
        eq(debts.status, "ACTIVE"),
      ),
    );
  return Number(row?.count ?? 0);
}
