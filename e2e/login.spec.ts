import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';

type LoginFixture = {
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
const LOGIN_BROWSER_ISSUE_PATTERN =
  /has either width or height modified|the width\(-1\) and height\(-1\) of chart should be greater than 0/i;

let fixture: LoginFixture | null = null;
let adminFixture: AdminFixture | null = null;
let serviceClient: ReturnType<typeof createClient<Database>> | null = null;

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

function trackLoginBrowserIssues(page: import('@playwright/test').Page) {
  const issues: string[] = [];

  const consoleHandler = (message: { type(): string; text(): string }) => {
    const text = message.text();
    if (LOGIN_BROWSER_ISSUE_PATTERN.test(text)) {
      issues.push(`[console:${message.type()}] ${text}`);
    }
  };

  const pageErrorHandler = (error: Error) => {
    issues.push(`[pageerror] ${error.message}`);
  };

  page.on('console', consoleHandler);
  page.on('pageerror', pageErrorHandler);

  return {
    expectClean() {
      page.off('console', consoleHandler);
      page.off('pageerror', pageErrorHandler);
      expect(issues, `Unexpected login/dashboard browser issues:\n${issues.join('\n')}`).toEqual([]);
    },
  };
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

  const userEmail = `qa-login+${Date.now()}@rutacero.local`;

  const { data, error } = await serviceClient.auth.admin.createUser({
    email: userEmail,
    password: USER_PASSWORD,
    email_confirm: true,
  });

  if (error || !data.user?.id) {
    throw new Error(`Failed to create E2E user: ${error?.message || 'Missing user id'}`);
  }

  const userId = data.user.id;
  const tenantSlug = `qa_${Date.now().toString(36)}`;

  const { data: tenant, error: tenantError } = await serviceClient
    .from('tenants')
    .insert({
      slug: tenantSlug,
      name: 'QA Tenant',
      created_by_user_id: userId,
    })
    .select('id')
    .single();

  if (tenantError || !tenant?.id) {
    throw new Error(`Failed to create tenant for E2E user: ${tenantError?.message || 'Missing tenant id'}`);
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
    throw new Error(`Failed to create tenant membership for E2E user: ${membershipError.message}`);
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
    throw new Error(`Failed to create profile for E2E user: ${profileError.message}`);
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
    throw new Error(`Failed to create subscription for E2E user: ${subscriptionError.message}`);
  }

  fixture = { userId, userEmail, userPassword: USER_PASSWORD, tenantId };
});

test.afterAll(async () => {
  if (!fixture?.userId || !serviceClient) return;
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
    .eq('channel', 'user')
    .eq('principal', fixture.userEmail.toLowerCase());
  await serviceClient.from('subscriptions').delete().eq('tenant_id', fixture.tenantId);
  await serviceClient.from('tenant_memberships').delete().eq('tenant_id', fixture.tenantId);
  await serviceClient.from('tenants').delete().eq('id', fixture.tenantId);
  await serviceClient.from('user_profiles').delete().eq('user_id', fixture.userId);
  await serviceClient.auth.admin.deleteUser(fixture.userId);
});

test('login de usuario redirige a /dashboard', async ({ page }) => {
  if (!fixture) throw new Error('Missing login fixture');
  const browserIssues = trackLoginBrowserIssues(page);

  await page.goto('/login');
  await page.getByLabel('Email').fill(fixture.userEmail);
  await page.getByLabel('Contraseña').fill(fixture.userPassword);
  await page.getByRole('button', { name: 'Ingresar' }).click();

  await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
  browserIssues.expectClean();
});

test('login de admin redirige a /admin/dashboard', async ({ page }) => {
  if (!serviceClient) throw new Error('Missing service client');
  if (!adminFixture) throw new Error('Missing admin fixture');
  const browserIssues = trackLoginBrowserIssues(page);

  const service = serviceClient;
  const admin = adminFixture;
  const startedAt = new Date().toISOString();
  await page.goto('/admin/login');
  await page.getByLabel('Correo Electrónico').fill(ADMIN_EMAIL);
  await page.getByLabel('Contraseña').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

  await expect(page).toHaveURL(/\/admin\/dashboard(?:\?.*)?$/);
  browserIssues.expectClean();

  await expect.poll(async () => {
    const { data, error } = await service
      .from('audit_logs')
      .select('admin_id, admin_user_id, entity_id, created_at')
      .eq('action', 'LOGIN')
      .eq('admin_user_id', admin.id)
      .gte('created_at', startedAt)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) return `error:${error.message}`;

    const latestLog = data?.[0];
    if (!latestLog) return 'missing';

    return `${latestLog.admin_user_id}:${latestLog.admin_id}:${latestLog.entity_id}`;
  }).toBe(`${admin.id}:${admin.id}:${admin.id}`);
});

test('login admin inválido muestra error y no redirige', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Correo Electrónico').fill(ADMIN_EMAIL);
  await page.getByLabel('Contraseña').fill('CredencialIncorrecta123!');
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

  await expect(page).toHaveURL(/\/admin\/login(?:\?.*)?$/);
  await expect(page.getByText(/Credenciales inválidas/i)).toBeVisible();
});

test('login admin aplica bloqueo progresivo al tercer fallo consecutivo', async ({ page }) => {
  if (!serviceClient) throw new Error('Missing service client');
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

  await page.goto('/admin/login');

  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.getByLabel('Correo Electrónico').fill(ADMIN_EMAIL);
    await page.getByLabel('Contraseña').fill(`CredencialIncorrecta-${attempt}`);
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

    if (attempt < 3) {
      await expect(page.getByText(/Credenciales inválidas/i)).toBeVisible();
    } else {
      await expect(page.getByText(/Cuenta temporalmente bloqueada|Demasiados intentos/i)).toBeVisible();
    }
  }
});

test('ruta /dashboard redirige a /login cuando no hay sesión', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
});
