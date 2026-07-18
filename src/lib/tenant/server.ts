'use server';

import { cache } from 'react';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { isGooglePlaySubscriptionExpired } from '@/lib/billing/google-play';

function userIdToPersonalSlug(userId: string) {
  return `u_${userId.replace(/-/g, '')}`;
}

/**
 * Ensures the user has a "personal" tenant and membership, and that
 * user_profiles.current_tenant_id is set. Uses service-role because this is
 * bootstrap logic (no tenant context yet).
 */
export async function ensureCurrentTenantForUser(userId: string): Promise<string> {
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

/**
 * Per-request memoization (audit 2026-07, perf P1): a single mutation flow
 * invoked this 3-4 times (action body, getUserPlan, feature/limit checks),
 * each run costing an auth round-trip + profile query + subscription query
 * — ~12 sequential round-trips for createDebt. React cache() dedupes to one
 * execution per request; the wrapper below keeps the 'use server' contract
 * (exports must be plain async functions).
 */
const requireUserTenantCached = cache(async () => {
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
