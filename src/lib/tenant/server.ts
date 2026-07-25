'use server';

import { cache } from 'react';
import { and, eq, sql } from 'drizzle-orm';
import type { User } from '@supabase/supabase-js';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { isGooglePlaySubscriptionExpired } from '@/lib/billing/google-play';
import { getAppUser } from '@/lib/auth/session';
import { isBetterAuthEnabled } from '@/lib/auth/provider';
import { isDrizzleEnabled } from '@/lib/data/provider';
import { getDb, type Db } from '@/db/client';
import {
  billingEntitlements,
  subscriptions,
  tenantMemberships,
  tenants,
  userProfiles,
} from '@/db/schema';

function appUserAsSupabaseUser(appUser: {
  id: string;
  email: string;
  name?: string | null;
}): User {
  return {
    id: appUser.id,
    email: appUser.email,
    app_metadata: {},
    user_metadata: appUser.name ? { full_name: appUser.name } : {},
    aud: 'authenticated',
    created_at: new Date(0).toISOString(),
  } as User;
}

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
 * user_profiles.current_tenant_id is set. Uses service-role (supabase) or
 * getDb() (drizzle) because this is bootstrap logic (no tenant context yet).
 */
export async function ensureCurrentTenantForUser(userId: string): Promise<string> {
  if (isDrizzleEnabled()) {
    return ensureCurrentTenantForUserDrizzle(userId);
  }

  const admin = createAdminClient();
  const slug = userIdToPersonalSlug(userId);

  // Find or create the tenant (slug is deterministic per user).
  const { data: existing } = await admin
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  let tenantId = existing?.id as string | undefined;

  if (!tenantId) {
    const { data: created, error: createError } = await admin
      .from('tenants')
      .insert({
        slug,
        name: 'Personal',
        created_by_user_id: userId,
      })
      .select('id')
      .single();

    if (createError || !created?.id) {
      throw new Error('Failed to create tenant');
    }

    tenantId = created.id as string;
  }

  // Ensure membership exists (OWNER).
  await admin
    .from('tenant_memberships')
    .upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        role: 'OWNER',
      },
      { onConflict: 'tenant_id,user_id' }
    );

  // Ensure user profile exists and current tenant is set.
  await admin.from('user_profiles').upsert(
    {
      user_id: userId,
      current_tenant_id: tenantId,
    },
    { onConflict: 'user_id' }
  );

  // Ensure a subscription row exists for this tenant (billing is per-tenant).
  await admin.from('subscriptions').upsert(
    {
      tenant_id: tenantId,
      user_id: userId, // purchaser/owner for now
      purchaser_user_id: userId,
      plan_code: 'FREE',
      status: 'ACTIVE',
      provider: 'recurrente',
    },
    { onConflict: 'tenant_id' }
  );

  return tenantId;
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

async function requireUserTenantDrizzle() {
  const supabase = await createClient();

  // Auth follows AUTH_PROVIDER (F2). Prefer the live Supabase user object when
  // available so existing RSC callers keep a full User shape; synthesize one
  // for better-auth sessions.
  let user: User;
  if (isBetterAuthEnabled()) {
    const appUser = await getAppUser();
    if (!appUser) {
      throw new Error('No autenticado');
    }
    user = appUserAsSupabaseUser(appUser);
  } else {
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();
    if (!supabaseUser) {
      throw new Error('No autenticado');
    }
    user = supabaseUser;
  }

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

  return { supabase, user, tenantId, db };
}

/**
 * Per-request memoization (audit 2026-07, perf P1): a single mutation flow
 * invoked this 3-4 times (action body, getUserPlan, feature/limit checks),
 * each run costing an auth round-trip + profile query + subscription query
 * — ~12 sequential round-trips for createDebt. React cache() dedupes to one
 * execution per request; the wrapper below keeps the 'use server' contract
 * (exports must be plain async functions).
 */
const requireUserTenantCached = cache(async () => {
  if (isDrizzleEnabled()) {
    return requireUserTenantDrizzle();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('No autenticado');
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('current_tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();

  let tenantId = profile?.current_tenant_id as string | null | undefined;
  if (!tenantId) {
    tenantId = await ensureCurrentTenantForUser(user.id);
  }

  const admin = createAdminClient();
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('provider, plan_code, renew_at, status')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (isGooglePlaySubscriptionExpired(subscription)) {
    const expiredAt = new Date().toISOString();

    await admin
      .from('billing_entitlements')
      .update({
        status: 'EXPIRED',
        updated_at: expiredAt,
      })
      .eq('tenant_id', tenantId)
      .eq('provider', 'google_play')
      .eq('status', 'ACTIVE');

    await admin
      .from('subscriptions')
      .update({
        plan_code: 'FREE',
        status: 'CANCELED',
        cancel_at: expiredAt,
        updated_at: expiredAt,
      })
      .eq('tenant_id', tenantId)
      .eq('provider', 'google_play');
  }

  return { supabase, user, tenantId };
});

export async function requireUserTenant() {
  return requireUserTenantCached();
}
