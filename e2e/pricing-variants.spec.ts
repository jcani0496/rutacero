import { expect, test, type Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';

type PricingFixture = {
  userId: string;
  userEmail: string;
  userPassword: string;
  tenantId: string;
};

const USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? 'User123!';

let serviceClient: ReturnType<typeof createClient<Database>> | null = null;
let fixture: PricingFixture | null = null;

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const index = trimmed.indexOf('=');
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function setupEnv() {
  loadEnvFile(path.join(process.cwd(), '.env.local'));
  loadEnvFile(path.join(process.cwd(), 'supabase', '.env'));
}

function ensureEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function runSeedAdmin() {
  const result = spawnSync('npm', ['run', 'seed:admin'], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(`seed:admin failed\n${result.stdout}\n${result.stderr}`);
  }
}

async function loginUser(page: Page, f: PricingFixture) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(f.userEmail);
  await page.getByLabel('Contraseña').fill(f.userPassword);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
}

test.beforeAll(async () => {
  setupEnv();
  runSeedAdmin();

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'http://127.0.0.1:54321';

  const serviceRoleKey = ensureEnvVar('SUPABASE_SERVICE_ROLE_KEY');
  serviceClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const userEmail = `qa-pricing+${Date.now()}@rutacero.local`;
  const { data, error } = await serviceClient.auth.admin.createUser({
    email: userEmail,
    password: USER_PASSWORD,
    email_confirm: true,
  });

  if (error || !data.user?.id) {
    throw new Error(`Failed to create pricing E2E user: ${error?.message || 'Missing user id'}`);
  }

  const userId = data.user.id;
  const tenantSlug = `qa_pricing_${Date.now().toString(36)}`;

  const { data: tenant, error: tenantError } = await serviceClient
    .from('tenants')
    .insert({
      slug: tenantSlug,
      name: 'QA Pricing Tenant',
      created_by_user_id: userId,
    })
    .select('id')
    .single();

  if (tenantError || !tenant?.id) {
    throw new Error(`Failed to create pricing tenant: ${tenantError?.message || 'Missing tenant id'}`);
  }

  const tenantId = tenant.id;

  const { error: membershipError } = await serviceClient.from('tenant_memberships').upsert(
    {
      tenant_id: tenantId,
      user_id: userId,
      role: 'OWNER',
    },
    { onConflict: 'tenant_id,user_id' },
  );

  if (membershipError) {
    throw new Error(`Failed to create tenant membership: ${membershipError.message}`);
  }

  const { error: profileError } = await serviceClient.from('user_profiles').upsert(
    {
      user_id: userId,
      onboarding_completed: true,
      current_tenant_id: tenantId,
    },
    { onConflict: 'user_id' },
  );

  if (profileError) {
    throw new Error(`Failed to create profile for pricing E2E user: ${profileError.message}`);
  }

  const { error: subscriptionError } = await serviceClient.from('subscriptions').upsert(
    {
      tenant_id: tenantId,
      user_id: userId,
      purchaser_user_id: userId,
      plan_code: 'FREE',
      status: 'ACTIVE',
      provider: 'recurrente',
    },
    { onConflict: 'tenant_id' },
  );

  if (subscriptionError) {
    throw new Error(`Failed to create subscription for pricing E2E user: ${subscriptionError.message}`);
  }

  fixture = { userId, userEmail, userPassword: USER_PASSWORD, tenantId };
});

test.afterAll(async () => {
  if (!fixture || !serviceClient) return;
  await serviceClient.from('subscriptions').delete().eq('tenant_id', fixture.tenantId);
  await serviceClient.from('tenant_memberships').delete().eq('tenant_id', fixture.tenantId);
  await serviceClient.from('tenants').delete().eq('id', fixture.tenantId);
  await serviceClient.from('user_profiles').delete().eq('user_id', fixture.userId);
  await serviceClient.auth.admin.deleteUser(fixture.userId);
});

test.describe('Pricing variants', () => {
  test('renders 3 PRO tiers with distinct prices', async ({ page }) => {
    if (!fixture) throw new Error('Missing pricing fixture');
    await loginUser(page, fixture);
    await page.goto('/pricing');

    await expect(page.getByText('Q49').first()).toBeVisible();
    await expect(page.getByText('Q119').first()).toBeVisible();
    await expect(page.getByText('Q399').first()).toBeVisible();
  });

  test('quarterly tier shows monthly equivalent (~Q39.67)', async ({ page }) => {
    if (!fixture) throw new Error('Missing pricing fixture');
    await loginUser(page, fixture);
    await page.goto('/pricing');

    // PRO_QUARTERLY: 119 / (90/30) = 39.6666... -> toFixed(2) = "39.67"
    await expect(page.getByText(/Q39\.\d+ por mes/)).toBeVisible();
  });

  test('annual tier shows monthly equivalent (~Q33.25)', async ({ page }) => {
    if (!fixture) throw new Error('Missing pricing fixture');
    await loginUser(page, fixture);
    await page.goto('/pricing');

    // PRO_ANNUAL: 399 / 12 = 33.25 (real calendar months — audit 2026-07)
    await expect(page.getByText(/Q33\.\d+ por mes/)).toBeVisible();
  });

  test('Más popular badge appears on quarterly tier only', async ({ page }) => {
    if (!fixture) throw new Error('Missing pricing fixture');
    await loginUser(page, fixture);
    await page.goto('/pricing');

    const badges = page.getByText('Más popular');
    await expect(badges).toHaveCount(1);
  });

  test('CTA buttons link to checkout with variant query parameter', async ({ page }) => {
    if (!fixture) throw new Error('Missing pricing fixture');
    await loginUser(page, fixture);
    await page.goto('/pricing');

    const ctaLinks = page.locator('a[href*="variant=PRO_"]');
    await expect(ctaLinks).toHaveCount(3);
    await expect(ctaLinks.first()).toBeVisible();
  });
});
