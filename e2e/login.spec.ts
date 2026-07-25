import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setupE2EEnv, withPg } from './helpers/pg';

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

test.beforeAll(async ({ request }) => {
  setupE2EEnv();
  runSeedAdmin();

  await withPg(async (client) => {
    await client.query(
      `DELETE FROM auth_login_lockouts WHERE channel = 'admin' AND principal = $1`,
      [ADMIN_EMAIL.toLowerCase()],
    );

    const adminResult = await client.query<{ id: string }>(
      `SELECT id FROM admin_users WHERE email = $1 LIMIT 1`,
      [ADMIN_EMAIL.toLowerCase()],
    );
    if (!adminResult.rows[0]?.id) {
      throw new Error('Failed to load admin fixture after seed:admin');
    }
    adminFixture = { id: adminResult.rows[0].id };
  });

  const userEmail = `qa-login+${Date.now()}@rutacero.local`;
  const signUp = await request.post('/api/auth/sign-up/email', {
    data: {
      email: userEmail,
      password: USER_PASSWORD,
      name: 'QA Login User',
    },
  });

  if (!signUp.ok()) {
    throw new Error(`Failed to create E2E user via better-auth: ${signUp.status()} ${await signUp.text()}`);
  }

  const payload = (await signUp.json()) as { user?: { id?: string } };
  const userId = payload.user?.id;
  if (!userId) {
    throw new Error('Failed to create E2E user: missing user id in sign-up response');
  }

  const tenantId = randomUUID();
  const tenantSlug = `qa_${Date.now().toString(36)}`;

  await withPg(async (client) => {
    await client.query(
      `INSERT INTO tenants (id, slug, name, created_by_user_id)
       VALUES ($1, $2, $3, $4)`,
      [tenantId, tenantSlug, 'QA Tenant', userId],
    );
    await client.query(
      `INSERT INTO tenant_memberships (tenant_id, user_id, role)
       VALUES ($1, $2, 'OWNER')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'OWNER'`,
      [tenantId, userId],
    );
    await client.query(
      `INSERT INTO user_profiles (user_id, onboarding_completed, current_tenant_id)
       VALUES ($1, true, $2)
       ON CONFLICT (user_id) DO UPDATE SET
         onboarding_completed = true,
         current_tenant_id = EXCLUDED.current_tenant_id`,
      [userId, tenantId],
    );
    await client.query(
      `INSERT INTO subscriptions (
         tenant_id, user_id, purchaser_user_id, plan_code, status, provider
       ) VALUES ($1, $2, $2, 'FREE', 'ACTIVE', 'recurrente')
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId, userId],
    );
  });

  fixture = { userId, userEmail, userPassword: USER_PASSWORD, tenantId };
});

test.afterAll(async () => {
  if (!fixture?.userId) return;
  const { userId, tenantId, userEmail } = fixture;
  await withPg(async (client) => {
    await client.query(
      `DELETE FROM auth_login_lockouts WHERE channel = 'user' AND principal = $1`,
      [userEmail.toLowerCase()],
    );
    await client.query(`DELETE FROM subscriptions WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM tenant_memberships WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM user_profiles WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
    await client.query(`DELETE FROM accounts WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
  });
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
  if (!adminFixture) throw new Error('Missing admin fixture');
  const browserIssues = trackLoginBrowserIssues(page);

  const admin = adminFixture;
  const startedAt = new Date().toISOString();
  await page.goto('/admin/login');
  await page.getByLabel('Correo Electrónico').fill(ADMIN_EMAIL);
  await page.getByLabel('Contraseña').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

  await expect(page).toHaveURL(/\/admin\/dashboard(?:\?.*)?$/);
  browserIssues.expectClean();

  await expect.poll(async () => {
    return withPg(async (client) => {
      const result = await client.query<{
        admin_user_id: string;
        entity_id: string;
      }>(
        `SELECT admin_user_id, entity_id
         FROM audit_logs
         WHERE action = 'LOGIN' AND admin_user_id = $1 AND created_at >= $2::timestamptz
         ORDER BY created_at DESC
         LIMIT 1`,
        [admin.id, startedAt],
      );
      const latestLog = result.rows[0];
      if (!latestLog) return 'missing';
      return `${latestLog.admin_user_id}:${latestLog.entity_id}`;
    });
  }).toBe(`${admin.id}:${admin.id}`);
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
  await withPg(async (client) => {
    await client.query(
      `DELETE FROM auth_login_lockouts WHERE channel = 'admin' AND principal = $1`,
      [ADMIN_EMAIL.toLowerCase()],
    );
  });

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
