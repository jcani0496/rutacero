import { afterAll, describe, expect, test } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), '.env.local'));
loadEnvFile(path.join(process.cwd(), 'supabase', '.env'));

if (
  (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY ||
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
) {
  const result = spawnSync('supabase', ['status', '-o', 'env'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (result.status === 0) {
    for (const line of result.stdout.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.includes('=')) continue;
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx);
      const value = trimmed.slice(idx + 1).replace(/^"|"$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

if (!process.env.SUPABASE_URL && process.env.API_URL) {
  process.env.SUPABASE_URL = process.env.API_URL;
}
if (!process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.ANON_KEY;
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const hasEnv = !!supabaseUrl && !!anonKey && !!serviceRoleKey;

function canReachSupabase(url: string) {
  if (!url) return false;
  const probe = spawnSync(
    process.execPath,
    [
      '-e',
      `
const net = require('node:net');
const target = new URL(process.argv[1]);
const socket = net.connect(Number(target.port || 80), target.hostname);
socket.on('connect', () => { socket.end(); process.exit(0); });
socket.on('error', () => process.exit(1));
setTimeout(() => process.exit(1), 800);
      `,
      url,
    ],
    { encoding: 'utf8' }
  );
  return probe.status === 0;
}

const hasReachableSupabase = hasEnv && canReachSupabase(supabaseUrl);

const runOrSkip = hasReachableSupabase ? test : test.skip;

const admin = hasReachableSupabase
  ? createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const cleanup: Array<() => Promise<void>> = [];

async function createUserWithTenant(email: string, password: string) {
  if (!admin) throw new Error('Missing admin client');

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user?.id) {
    throw new Error(`Failed to create test user: ${createError?.message || 'missing user id'}`);
  }
  const userId = created.user.id;
  const tenantSlug = `entrls_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .insert({ slug: tenantSlug, name: 'Entitlements RLS Test', created_by_user_id: userId })
    .select('id')
    .single();
  if (tenantError || !tenant?.id) {
    throw new Error(`Failed to create tenant: ${tenantError?.message || 'missing tenant id'}`);
  }

  const tenantId = tenant.id;
  const { error: membershipError } = await admin
    .from('tenant_memberships')
    .upsert({ tenant_id: tenantId, user_id: userId, role: 'OWNER' }, { onConflict: 'tenant_id,user_id' });
  if (membershipError) throw new Error(`Failed to create membership: ${membershipError.message}`);

  const { error: profileError } = await admin.from('user_profiles').upsert(
    { user_id: userId, current_tenant_id: tenantId, onboarding_completed: true },
    { onConflict: 'user_id' }
  );
  if (profileError) throw new Error(`Failed to create profile: ${profileError.message}`);

  cleanup.push(async () => {
    await admin.from('billing_entitlements').delete().eq('tenant_id', tenantId);
    await admin.from('tenant_memberships').delete().eq('tenant_id', tenantId);
    await admin.from('tenants').delete().eq('id', tenantId);
    await admin.from('user_profiles').delete().eq('user_id', userId);
    await admin.auth.admin.deleteUser(userId);
  });

  return { userId, tenantId, email, password };
}

async function loginAnon(email: string, password: string) {
  const client = createClient<Database>(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Failed anon login for ${email}: ${error.message}`);
  return client;
}

describe('Security: billing_entitlements RLS', () => {
  runOrSkip('user B cannot see user A entitlements via RLS', async () => {
    const suffix = Date.now();
    const userA = await createUserWithTenant(`ent-rls-a+${suffix}@rutacero.local`, 'User123!');
    const userB = await createUserWithTenant(`ent-rls-b+${suffix}@rutacero.local`, 'User123!');

    const purchaseTokenA = `tok_a_${suffix}_${Math.random().toString(36).slice(2, 10)}`;
    const { data: entA, error: entAError } = await admin!
      .from('billing_entitlements')
      .insert({
        tenant_id: userA.tenantId,
        user_id: userA.userId,
        provider: 'google_play',
        platform: 'android',
        product_id: 'pro_monthly',
        purchase_token: purchaseTokenA,
        status: 'ACTIVE',
        raw_response: { sensitive: 'data_for_a' },
      })
      .select('id')
      .single();
    if (entAError || !entA?.id) {
      throw new Error(`Failed creating entitlement A: ${entAError?.message}`);
    }

    const clientA = await loginAnon(userA.email, userA.password);
    const clientB = await loginAnon(userB.email, userB.password);

    // user A should see their own entitlement
    const readAsA = await clientA
      .from('billing_entitlements')
      .select('id, tenant_id, purchase_token')
      .eq('id', entA.id);
    expect(readAsA.error).toBeNull();
    expect(readAsA.data?.length).toBe(1);
    expect(readAsA.data?.[0]?.id).toBe(entA.id);

    // user B must not see user A's entitlement (RLS hides it; no error)
    const readAsB = await clientB
      .from('billing_entitlements')
      .select('id, tenant_id, purchase_token')
      .eq('id', entA.id);
    expect(readAsB.error).toBeNull();
    expect(readAsB.data?.length).toBe(0);

    // user B also cannot scan by tenant_id
    const scanAsB = await clientB
      .from('billing_entitlements')
      .select('id')
      .eq('tenant_id', userA.tenantId);
    expect(scanAsB.error).toBeNull();
    expect(scanAsB.data?.length).toBe(0);
  });

  runOrSkip('anon (no auth) cannot read any entitlements', async () => {
    const suffix = Date.now();
    const userA = await createUserWithTenant(`ent-rls-anon+${suffix}@rutacero.local`, 'User123!');

    const purchaseTokenA = `tok_anon_${suffix}_${Math.random().toString(36).slice(2, 10)}`;
    const { data: entA, error: entAError } = await admin!
      .from('billing_entitlements')
      .insert({
        tenant_id: userA.tenantId,
        user_id: userA.userId,
        provider: 'google_play',
        platform: 'android',
        product_id: 'pro_monthly',
        purchase_token: purchaseTokenA,
        status: 'ACTIVE',
        raw_response: { sensitive: 'anon_test' },
      })
      .select('id')
      .single();
    if (entAError || !entA?.id) {
      throw new Error(`Failed creating entitlement A: ${entAError?.message}`);
    }

    const anonClient = createClient<Database>(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const result = await anonClient.from('billing_entitlements').select('id').limit(10);
    expect(result.error).toBeNull();
    expect(result.data?.length).toBe(0);

    const targeted = await anonClient
      .from('billing_entitlements')
      .select('id')
      .eq('id', entA.id);
    expect(targeted.error).toBeNull();
    expect(targeted.data?.length).toBe(0);
  });

  runOrSkip('service role can write entitlements (sanity)', async () => {
    const suffix = Date.now();
    const userA = await createUserWithTenant(`ent-rls-svc+${suffix}@rutacero.local`, 'User123!');

    const purchaseTokenA = `tok_svc_${suffix}_${Math.random().toString(36).slice(2, 10)}`;
    const insert = await admin!
      .from('billing_entitlements')
      .insert({
        tenant_id: userA.tenantId,
        user_id: userA.userId,
        provider: 'google_play',
        platform: 'android',
        product_id: 'pro_monthly',
        purchase_token: purchaseTokenA,
        status: 'ACTIVE',
        raw_response: { sensitive: 'svc_test' },
      })
      .select('id, status')
      .single();
    expect(insert.error).toBeNull();
    expect(insert.data?.id).toBeTruthy();
    expect(insert.data?.status).toBe('ACTIVE');
  });
});

afterAll(async () => {
  while (cleanup.length > 0) {
    const fn = cleanup.pop();
    if (!fn) continue;
    await fn();
  }
});
