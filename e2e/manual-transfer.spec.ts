import { expect, test, type Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';

type ManualFixture = {
  userId: string;
  userEmail: string;
  userPassword: string;
  tenantId: string;
};

const USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? 'User123!';

let serviceClient: ReturnType<typeof createClient<Database>> | null = null;
let fixture: ManualFixture | null = null;

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const index = trimmed.indexOf('=');
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
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

async function loginUser(page: Page, f: ManualFixture) {
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

  const userEmail = `qa-manual+${Date.now()}@rutacero.local`;
  const { data, error } = await serviceClient.auth.admin.createUser({
    email: userEmail,
    password: USER_PASSWORD,
    email_confirm: true,
  });

  if (error || !data.user?.id) {
    throw new Error(`Failed to create manual-transfer E2E user: ${error?.message || 'Missing user id'}`);
  }

  const userId = data.user.id;
  const tenantSlug = `qa_manual_${Date.now().toString(36)}`;

  const { data: tenant, error: tenantError } = await serviceClient
    .from('tenants')
    .insert({
      slug: tenantSlug,
      name: 'QA Manual Transfer Tenant',
      created_by_user_id: userId,
    })
    .select('id')
    .single();

  if (tenantError || !tenant?.id) {
    throw new Error(`Failed to create manual-transfer tenant: ${tenantError?.message || 'Missing tenant id'}`);
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
    throw new Error(`Failed to create profile for manual-transfer E2E user: ${profileError.message}`);
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
    throw new Error(`Failed to create subscription for manual-transfer E2E user: ${subscriptionError.message}`);
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

test.describe('Manual transfer flow', () => {
  test('produces a reference code on success', async ({ page }) => {
    if (!fixture) throw new Error('Missing manual-transfer fixture');

    // Resend must be configured locally for the email send to succeed. If it's not
    // available, skip cleanly rather than fail — this is a smoke E2E, not infra check.
    if (!process.env.RESEND_API_KEY) {
      test.skip(true, 'RESEND_API_KEY is not configured; skipping manual transfer smoke.');
    }

    await loginUser(page, fixture);
    await page.goto('/pago-manual');
    await expect(
      page.getByRole('heading', { name: /pago por transferencia bancaria/i }),
    ).toBeVisible();

    // Three tier cards (PRO_MONTHLY, PRO_QUARTERLY, PRO_ANNUAL) each render one
    // "Pagar por transferencia" button. PRO_QUARTERLY is index 1.
    const buttons = page.getByRole('button', { name: /pagar por transferencia/i });
    await expect(buttons).toHaveCount(3);

    // Watch the manual-transfer endpoint response so we can skip cleanly when
    // the local Resend setup cannot send (e.g. unverified sender domain) instead
    // of failing on a missing UI panel.
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/billing/manual-transfer') && res.request().method() === 'POST',
      { timeout: 30_000 },
    );

    await buttons.nth(1).click();

    const apiResponse = await responsePromise;
    if (apiResponse.status() !== 200) {
      let errorCode: string | undefined;
      try {
        const body = (await apiResponse.json()) as { error?: string };
        errorCode = body.error;
      } catch {
        // ignore parse failure
      }
      if (errorCode === 'EMAIL_SEND_FAILED' || errorCode === 'SERVICE_UNAVAILABLE') {
        test.skip(
          true,
          `Manual transfer email could not be sent in this environment (error=${errorCode}). ` +
            'Configure a Resend key with a verified sender domain and BANK_TRANSFER_INSTRUCTIONS_JSON to exercise this flow.',
        );
        return;
      }
      throw new Error(
        `Manual transfer endpoint returned unexpected status ${apiResponse.status()} (error=${errorCode ?? 'unknown'})`,
      );
    }

    // The success panel renders the referenceCode in a font-mono <p>.
    await expect(
      page.getByText(/^RC-[0-9A-F]{8}-[0-9A-Z]+-[0-9A-Z]{4}$/),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole('heading', { name: /te enviamos las instrucciones/i }),
    ).toBeVisible();
  });
});
