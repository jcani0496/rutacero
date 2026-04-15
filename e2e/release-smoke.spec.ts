import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';

type UserFixture = {
  userId: string;
  userEmail: string;
  userPassword: string;
  tenantId: string;
};

type AdminFixture = {
  id: string;
};

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@rutacero.gt';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Admin123!';
const USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? 'User123!';
let serviceClient: ReturnType<typeof createClient<Database>> | null = null;
let adminFixture: AdminFixture | null = null;
let userFixture: UserFixture | null = null;

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

function isMockModeEnabled() {
  return process.env.RECURRENTE_MOCK_MODE === 'true';
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

async function createUserFixture(): Promise<UserFixture> {
  if (!serviceClient) throw new Error('Missing service client');

  const userEmail = `qa-release-smoke-${Date.now()}@rutacero.local`;
  const { data, error } = await serviceClient.auth.admin.createUser({
    email: userEmail,
    password: USER_PASSWORD,
    email_confirm: true,
  });

  if (error || !data.user?.id) {
    throw new Error(`Failed to create smoke user: ${error?.message || 'Missing user id'}`);
  }

  const userId = data.user.id;
  const tenantSlug = `qa_release_smoke_${Date.now().toString(36)}`;

  const { data: tenant, error: tenantError } = await serviceClient
    .from('tenants')
    .insert({
      slug: tenantSlug,
      name: 'QA Release Smoke Tenant',
      created_by_user_id: userId,
    })
    .select('id')
    .single();

  if (tenantError || !tenant?.id) {
    throw new Error(`Failed to create smoke tenant: ${tenantError?.message || 'Missing tenant id'}`);
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
    throw new Error(`Failed to create smoke tenant membership: ${membershipError.message}`);
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
    throw new Error(`Failed to create smoke user profile: ${profileError.message}`);
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
    throw new Error(`Failed to create smoke subscription: ${subscriptionError.message}`);
  }

  return {
    userId,
    userEmail,
    userPassword: USER_PASSWORD,
    tenantId,
  };
}

async function cleanupUserFixture(fixture: UserFixture | null) {
  if (!fixture || !serviceClient) return;

  await serviceClient.from('recurrente_checkout_contexts').delete().eq('tenant_id', fixture.tenantId);
  await serviceClient.from('subscriptions').delete().eq('tenant_id', fixture.tenantId);
  await serviceClient.from('tenant_memberships').delete().eq('tenant_id', fixture.tenantId);
  await serviceClient.from('tenants').delete().eq('id', fixture.tenantId);
  await serviceClient.from('user_profiles').delete().eq('user_id', fixture.userId);
  await serviceClient.auth.admin.deleteUser(fixture.userId);
}

async function loginUser(page: import('@playwright/test').Page, fixture: UserFixture) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(fixture.userEmail);
  await page.getByLabel('Contraseña').fill(fixture.userPassword);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
}

async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Correo Electrónico').fill(ADMIN_EMAIL);
  await page.getByLabel('Contraseña').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard(?:\?.*)?$/);
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

  await (serviceClient as unknown as {
    from: (table: string) => {
      delete: () => {
        eq: (column: string, value: string) => {
          eq: (column2: string, value2: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
  })
    .from('auth_login_lockouts')
    .delete()
    .eq('channel', 'admin')
    .eq('principal', ADMIN_EMAIL.toLowerCase());

  const { data: adminData, error: adminError } = await serviceClient
    .from('admin_users')
    .select('id')
    .eq('email', ADMIN_EMAIL.toLowerCase())
    .single();

  if (adminError || !adminData?.id) {
    throw new Error(`Failed to load admin fixture: ${adminError?.message || 'Missing admin id'}`);
  }

  adminFixture = { id: adminData.id };
  userFixture = await createUserFixture();
});

test.afterAll(async () => {
  await cleanupUserFixture(userFixture);
});

test('admin reports page loads for admin users', async ({ page }) => {
  if (!adminFixture) throw new Error('Missing admin fixture');

  await loginAdmin(page);
  await page.goto('/admin/reports');

  await expect(page).toHaveURL(/\/admin\/reports(?:\?.*)?$/);
  await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Reportes Estándar' })).toBeVisible();
  await expect(page.getByText(/No pudimos/i)).toHaveCount(0);
});

test('checkout creates a mock recurrente session and persists context', async ({ page }) => {
  test.skip(!isMockModeEnabled(), 'Requires RECURRENTE_MOCK_MODE=true');
  if (!userFixture || !serviceClient) throw new Error('Missing smoke user fixture');

  const fixture = userFixture;
  const client = serviceClient;
  await loginUser(page, fixture);
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Suscribirse Ahora' }).click();

  await expect(page).toHaveURL(/\/checkout\/success\?session_id=chk_local_[^&]+&mock_recurrente=1/);

  await expect
    .poll(async () => {
      const { data, error } = await client
        .from('recurrente_checkout_contexts')
        .select('checkout_id')
        .eq('tenant_id', fixture.tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return `error:${error.message}`;

      return data?.checkout_id ?? 'missing';
    })
    .toMatch(/^chk_local_/);
});
