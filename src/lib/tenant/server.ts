'use server';

import { cache } from 'react';
import { and, eq, sql } from 'drizzle-orm';
import { isGooglePlaySubscriptionExpired } from '@/lib/billing/google-play';
import { getAppUser, type AppUser } from '@/lib/auth/session';
import { getDb, type Db } from '@/db/client';
import {
  billingEntitlements,
  subscriptions,
  tenantMemberships,
  tenants,
  userProfiles,
} from '@/db/schema';

/** Session user shape used across server actions (F6: better-auth). */
export type TenantUser = AppUser & {
  user_metadata?: { full_name?: string | null; name?: string | null };
};

function userIdToPersonalSlug(userId: string) {
  return `u_${userId.replace(/-/g, '')}`;
}

async function ensureCurrentTenantForUserDrizzle(userId: string): Promise<string> {
  const db = getDb();
  const slug = userIdToPersonalSlug(userId);

  const [existing] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  let tenantId = existing?.id;

  if (!tenantId) {
    const [created] = await db
      .insert(tenants)
      .values({
        slug,
        name: 'Personal',
        createdByUserId: userId,
      })
      .returning({ id: tenants.id });

    if (!created?.id) {
      throw new Error('Failed to create tenant');
    }

    tenantId = created.id;
  }

  await db
    .insert(tenantMemberships)
    .values({
      tenantId,
      userId,
      role: 'OWNER',
    })
    .onConflictDoUpdate({
      target: [tenantMemberships.tenantId, tenantMemberships.userId],
      set: { role: 'OWNER' },
    });

  await db
    .insert(userProfiles)
    .values({
      userId,
      currentTenantId: tenantId,
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        currentTenantId: tenantId,
        updatedAt: sql`now()`,
      },
    });

  // Insert-only on conflict: do not clobber an existing paid subscription.
  await db
    .insert(subscriptions)
    .values({
      tenantId,
      userId,
      purchaserUserId: userId,
      planCode: 'FREE',
      status: 'ACTIVE',
      provider: 'recurrente',
    })
    .onConflictDoNothing({ target: subscriptions.tenantId });

  return tenantId;
}

/**
 * Ensures the user has a "personal" tenant and membership, and that
 * user_profiles.current_tenant_id is set.
 */
export async function ensureCurrentTenantForUser(userId: string): Promise<string> {
  return ensureCurrentTenantForUserDrizzle(userId);
}

async function expireGooglePlaySubscriptionDrizzle(
  db: Db,
  tenantId: string,
  subscription: {
    provider: string | null;
    planCode: string | null;
    renewAt: Date | null;
    status: string | null;
  } | null,
) {
  const expired = isGooglePlaySubscriptionExpired(
    subscription
      ? {
          provider: subscription.provider,
          plan_code: subscription.planCode,
          renew_at: subscription.renewAt?.toISOString() ?? null,
          status: subscription.status,
        }
      : null,
  );

  if (!expired) return;

  const expiredAt = new Date();

  await db
    .update(billingEntitlements)
    .set({
      status: 'EXPIRED',
      updatedAt: expiredAt,
    })
    .where(
      and(
        eq(billingEntitlements.tenantId, tenantId),
        eq(billingEntitlements.provider, 'google_play'),
        eq(billingEntitlements.status, 'ACTIVE'),
      ),
    );

  await db
    .update(subscriptions)
    .set({
      planCode: 'FREE',
      status: 'CANCELED',
      cancelAt: expiredAt,
      updatedAt: expiredAt,
    })
    .where(
      and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.provider, 'google_play'),
      ),
    );
}

/**
 * Per-request memoization: a single mutation flow invoked this 3-4 times.
 * React cache() dedupes to one execution per request.
 */
const requireUserTenantCached = cache(async () => {
  const appUser = await getAppUser();
  if (!appUser) {
    throw new Error('No autenticado');
  }

  const user: TenantUser = {
    ...appUser,
    user_metadata: { full_name: appUser.name, name: appUser.name },
  };

  const db = getDb();

  const [profile] = await db
    .select({ currentTenantId: userProfiles.currentTenantId })
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  let tenantId = profile?.currentTenantId ?? null;
  if (!tenantId) {
    tenantId = await ensureCurrentTenantForUser(user.id);
  }

  const [subscription] = await db
    .select({
      provider: subscriptions.provider,
      planCode: subscriptions.planCode,
      renewAt: subscriptions.renewAt,
      status: subscriptions.status,
    })
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);

  await expireGooglePlaySubscriptionDrizzle(db, tenantId, subscription ?? null);

  // `supabase` retained for dual-path callers still destructuring it;
  // dead Supabase branches must not run (DATA_PROVIDER defaults to drizzle).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { supabase: null as any, user, tenantId, db };
});

export async function requireUserTenant() {
  return requireUserTenantCached();
}
