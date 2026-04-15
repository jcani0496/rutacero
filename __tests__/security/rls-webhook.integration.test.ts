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
  const tenantSlug = `rls_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .insert({ slug: tenantSlug, name: 'RLS Test', created_by_user_id: userId })
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

  const { error: subscriptionError } = await admin.from('subscriptions').upsert(
    {
      tenant_id: tenantId,
      user_id: userId,
      purchaser_user_id: userId,
      plan_code: 'FREE',
      status: 'ACTIVE',
      provider: 'recurrente',
    },
    { onConflict: 'tenant_id' }
  );
  if (subscriptionError) throw new Error(`Failed to create subscription: ${subscriptionError.message}`);

  cleanup.push(async () => {
    await admin.from('debts').delete().eq('tenant_id', tenantId);
    await admin.from('subscriptions').delete().eq('tenant_id', tenantId);
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

async function assertOnlyOwnRowsVisible(params: {
  table: 'debts' | 'payments' | 'plans' | 'support_tickets';
  ids: [string, string];
  clientA: ReturnType<typeof createClient<Database>>;
  clientB: ReturnType<typeof createClient<Database>>;
}) {
  const { table, ids, clientA, clientB } = params;

  const readAsA = await clientA.from(table).select('id, user_id').in('id', ids);
  if (readAsA.error) throw new Error(`Read as A failed for ${table}: ${readAsA.error.message}`);

  const readAsB = await clientB.from(table).select('id, user_id').in('id', ids);
  if (readAsB.error) throw new Error(`Read as B failed for ${table}: ${readAsB.error.message}`);

  expect(readAsA.data?.some((row) => row.id === ids[0])).toBe(true);
  expect(readAsA.data?.some((row) => row.id === ids[1])).toBe(false);
  expect(readAsB.data?.some((row) => row.id === ids[1])).toBe(true);
  expect(readAsB.data?.some((row) => row.id === ids[0])).toBe(false);
}

describe('Security Integration', () => {
  runOrSkip('RLS: user A no puede leer deuda de user B', async () => {
    const userA = await createUserWithTenant(`rls-a+${Date.now()}@rutacero.local`, 'User123!');
    const userB = await createUserWithTenant(`rls-b+${Date.now()}@rutacero.local`, 'User123!');

    const { data: debtA, error: debtAError } = await admin!.from('debts').insert({
      user_id: userA.userId,
      tenant_id: userA.tenantId,
      creditor: 'Banco A',
      balance: 1200,
      next_payment_date: new Date().toISOString(),
      type: 'CREDIT_CARD',
    }).select('id').single();
    if (debtAError || !debtA?.id) throw new Error(`Failed creating debt A: ${debtAError?.message}`);

    const { data: debtB, error: debtBError } = await admin!.from('debts').insert({
      user_id: userB.userId,
      tenant_id: userB.tenantId,
      creditor: 'Banco B',
      balance: 900,
      next_payment_date: new Date().toISOString(),
      type: 'LOAN',
    }).select('id').single();
    if (debtBError || !debtB?.id) throw new Error(`Failed creating debt B: ${debtBError?.message}`);

    const clientA = await loginAnon(userA.email, userA.password);
    const clientB = await loginAnon(userB.email, userB.password);

    await assertOnlyOwnRowsVisible({
      table: 'debts',
      ids: [debtA.id, debtB.id],
      clientA,
      clientB,
    });
  });

  runOrSkip('RLS: payments, plans y support_tickets permanecen aislados por tenant y usuario', async () => {
    const suffix = Date.now();
    const userA = await createUserWithTenant(`rls-multi-a+${suffix}@rutacero.local`, 'User123!');
    const userB = await createUserWithTenant(`rls-multi-b+${suffix}@rutacero.local`, 'User123!');

    const { data: debtA, error: debtAError } = await admin!.from('debts').insert({
      user_id: userA.userId,
      tenant_id: userA.tenantId,
      creditor: 'Banco A',
      balance: 2400,
      next_payment_date: new Date().toISOString(),
      type: 'CREDIT_CARD',
    }).select('id').single();
    if (debtAError || !debtA?.id) throw new Error(`Failed creating debt A: ${debtAError?.message}`);

    const { data: debtB, error: debtBError } = await admin!.from('debts').insert({
      user_id: userB.userId,
      tenant_id: userB.tenantId,
      creditor: 'Banco B',
      balance: 1800,
      next_payment_date: new Date().toISOString(),
      type: 'LOAN',
    }).select('id').single();
    if (debtBError || !debtB?.id) throw new Error(`Failed creating debt B: ${debtBError?.message}`);

    const [{ data: paymentA, error: paymentAError }, { data: paymentB, error: paymentBError }] = await Promise.all([
      admin!.from('payments').insert({
        user_id: userA.userId,
        tenant_id: userA.tenantId,
        debt_id: debtA.id,
        amount: 100,
        payment_date: new Date().toISOString().slice(0, 10),
      }).select('id').single(),
      admin!.from('payments').insert({
        user_id: userB.userId,
        tenant_id: userB.tenantId,
        debt_id: debtB.id,
        amount: 100,
        payment_date: new Date().toISOString().slice(0, 10),
      }).select('id').single(),
    ]);
    if (paymentAError || !paymentA?.id) throw new Error(`Failed creating payment A: ${paymentAError?.message}`);
    if (paymentBError || !paymentB?.id) throw new Error(`Failed creating payment B: ${paymentBError?.message}`);

    const [{ data: planA, error: planAError }, { data: planB, error: planBError }] = await Promise.all([
      admin!.from('plans').insert({
        user_id: userA.userId,
        tenant_id: userA.tenantId,
        strategy: 'AVALANCHE',
        engine_version: 'test',
        eta_debt_free: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }).select('id').single(),
      admin!.from('plans').insert({
        user_id: userB.userId,
        tenant_id: userB.tenantId,
        strategy: 'SNOWBALL',
        engine_version: 'test',
        eta_debt_free: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }).select('id').single(),
    ]);
    if (planAError || !planA?.id) throw new Error(`Failed creating plan A: ${planAError?.message}`);
    if (planBError || !planB?.id) throw new Error(`Failed creating plan B: ${planBError?.message}`);

    const [{ data: ticketA, error: ticketAError }, { data: ticketB, error: ticketBError }] = await Promise.all([
      admin!.from('support_tickets').insert({
        user_id: userA.userId,
        tenant_id: userA.tenantId,
        subject: 'Ticket A',
        description: 'Descripcion A',
        body: 'Descripcion A',
        category: 'OTHER',
        priority: 'MEDIUM',
      }).select('id').single(),
      admin!.from('support_tickets').insert({
        user_id: userB.userId,
        tenant_id: userB.tenantId,
        subject: 'Ticket B',
        description: 'Descripcion B',
        body: 'Descripcion B',
        category: 'OTHER',
        priority: 'MEDIUM',
      }).select('id').single(),
    ]);
    if (ticketAError || !ticketA?.id) throw new Error(`Failed creating ticket A: ${ticketAError?.message}`);
    if (ticketBError || !ticketB?.id) throw new Error(`Failed creating ticket B: ${ticketBError?.message}`);

    const clientA = await loginAnon(userA.email, userA.password);
    const clientB = await loginAnon(userB.email, userB.password);

    await assertOnlyOwnRowsVisible({
      table: 'payments',
      ids: [paymentA.id, paymentB.id],
      clientA,
      clientB,
    });
    await assertOnlyOwnRowsVisible({
      table: 'plans',
      ids: [planA.id, planB.id],
      clientA,
      clientB,
    });
    await assertOnlyOwnRowsVisible({
      table: 'support_tickets',
      ids: [ticketA.id, ticketB.id],
      clientA,
      clientB,
    });
  });

  runOrSkip('Webhook replay: unique(provider, external_event_id) evita duplicados', async () => {
    const externalEventId = `evt_replay_${Date.now()}`;
    const payload = { test: true, id: externalEventId };

    const firstInsert = await admin!.from('payment_webhook_events').insert({
      provider: 'recurrente',
      external_event_id: externalEventId,
      payload,
      processed: false,
    });
    expect(firstInsert.error).toBeNull();

    const duplicateInsert = await admin!.from('payment_webhook_events').insert({
      provider: 'recurrente',
      external_event_id: externalEventId,
      payload,
      processed: false,
    });
    expect(duplicateInsert.error).not.toBeNull();
    expect(duplicateInsert.error?.code).toBe('23505');

    cleanup.push(async () => {
      await admin!.from('payment_webhook_events').delete().eq('external_event_id', externalEventId);
    });
  });
});

afterAll(async () => {
  while (cleanup.length > 0) {
    const fn = cleanup.pop();
    if (!fn) continue;
    await fn();
  }
});
