import { expect, test, type Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';

type PlanFixture = {
  userId: string;
  userEmail: string;
  userPassword: string;
  tenantId: string;
};

const USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? 'User123!';
const PLAN_BROWSER_ISSUE_PATTERN =
  /hydration|validatedomnesting|cannot be a descendant of <p>|cannot contain a nested <(?:div|p|ul)|<p> cannot|has either width or height modified|the width\(-1\) and height\(-1\) of chart should be greater than 0/i;

let serviceClient: ReturnType<typeof createClient<Database>> | null = null;
let feasibleFixture: PlanFixture | null = null;
let shortfallFixture: PlanFixture | null = null;

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

async function createPlanFixture(input: {
  label: string;
  incomeAmount: number;
  expenseBudgetAmount: number;
  debts: Array<{
    creditor: string;
    balance: number;
    apr: number;
    min_payment: number;
    type: Database['public']['Tables']['debts']['Insert']['type'];
    due_date: number;
  }>;
}): Promise<PlanFixture> {
  if (!serviceClient) throw new Error('Missing service client');

  const userEmail = `qa-plan-${input.label}-${Date.now()}@rutacero.local`;
  const { data, error } = await serviceClient.auth.admin.createUser({
    email: userEmail,
    password: USER_PASSWORD,
    email_confirm: true,
  });

  if (error || !data.user?.id) {
    throw new Error(`Failed to create plan E2E user: ${error?.message || 'Missing user id'}`);
  }

  const userId = data.user.id;
  const tenantSlug = `qa_plan_${input.label}_${Date.now().toString(36)}`;
  const today = new Date();
  const isoDate = today.toISOString().split('T')[0];

  const { data: tenant, error: tenantError } = await serviceClient
    .from('tenants')
    .insert({
      slug: tenantSlug,
      name: `QA Plan ${input.label}`,
      created_by_user_id: userId,
    })
    .select('id')
    .single();

  if (tenantError || !tenant?.id) {
    throw new Error(`Failed to create plan tenant: ${tenantError?.message || 'Missing tenant id'}`);
  }

  const tenantId = tenant.id;

  const { error: membershipError } = await serviceClient.from('tenant_memberships').upsert(
    {
      tenant_id: tenantId,
      user_id: userId,
      role: 'OWNER',
    },
    { onConflict: 'tenant_id,user_id' }
  );

  if (membershipError) {
    throw new Error(`Failed to create tenant membership: ${membershipError.message}`);
  }

  const { error: profileError } = await serviceClient.from('user_profiles').upsert(
    {
      user_id: userId,
      currency_base: 'GTQ',
      goal_type: 'BALANCED',
      motivation_level: 3,
      risk_tolerance: 3,
      safety_buffer_pct: 10,
      onboarding_completed: true,
      current_tenant_id: tenantId,
    },
    { onConflict: 'user_id' }
  );

  if (profileError) {
    throw new Error(`Failed to create profile for plan E2E user: ${profileError.message}`);
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
    { onConflict: 'tenant_id' }
  );

  if (subscriptionError) {
    throw new Error(`Failed to create subscription for plan E2E user: ${subscriptionError.message}`);
  }

  const { error: incomeError } = await serviceClient.from('income_events').insert({
    tenant_id: tenantId,
    user_id: userId,
    amount: input.incomeAmount,
    date: isoDate,
    type: 'FIXED',
    source: 'QA Salary',
    currency: 'GTQ',
    notes: 'Playwright fixture',
  });

  if (incomeError) {
    throw new Error(`Failed to create income for plan E2E user: ${incomeError.message}`);
  }

  const { error: expenseError } = await serviceClient.from('essential_expenses').insert({
    tenant_id: tenantId,
    user_id: userId,
    name: 'QA Essential Expense',
    amount: input.expenseBudgetAmount,
    budget_amount: input.expenseBudgetAmount,
    actual_amount: input.expenseBudgetAmount,
    frequency: 'MONTHLY',
    expense_type: 'NEED',
    category: 'QA',
    next_date: isoDate,
    currency: 'GTQ',
  });

  if (expenseError) {
    throw new Error(`Failed to create expense for plan E2E user: ${expenseError.message}`);
  }

  const { error: debtsError } = await serviceClient.from('debts').insert(
    input.debts.map((debt) => ({
      tenant_id: tenantId,
      user_id: userId,
      creditor: debt.creditor,
      type: debt.type,
      balance: debt.balance,
      apr: debt.apr,
      min_payment: debt.min_payment,
      due_date: debt.due_date,
      payment_day: debt.due_date,
      interest_model: debt.type === 'CREDIT_CARD' ? 'DAILY_SIMPLE' : 'MONTHLY_SIMPLE',
      monthly_fees: 0,
      next_payment_date: isoDate,
      currency: 'GTQ',
      status: 'ACTIVE',
      notes: 'Playwright fixture',
      goal_extra_payment: 0,
    }))
  );

  if (debtsError) {
    throw new Error(`Failed to create debts for plan E2E user: ${debtsError.message}`);
  }

  return {
    userId,
    userEmail,
    userPassword: USER_PASSWORD,
    tenantId,
  };
}

async function cleanupPlanFixture(fixture: PlanFixture | null) {
  if (!fixture || !serviceClient) return;

  await serviceClient.from('plan_items').delete().eq('tenant_id', fixture.tenantId);
  await serviceClient.from('plans').delete().eq('tenant_id', fixture.tenantId);
  await serviceClient.from('debts').delete().eq('tenant_id', fixture.tenantId);
  await serviceClient.from('income_events').delete().eq('tenant_id', fixture.tenantId);
  await serviceClient.from('essential_expenses').delete().eq('tenant_id', fixture.tenantId);
  await serviceClient.from('subscriptions').delete().eq('tenant_id', fixture.tenantId);
  await serviceClient.from('tenant_memberships').delete().eq('tenant_id', fixture.tenantId);
  await serviceClient.from('tenants').delete().eq('id', fixture.tenantId);
  await serviceClient.from('user_profiles').delete().eq('user_id', fixture.userId);
  await serviceClient.auth.admin.deleteUser(fixture.userId);
}

async function loginUser(page: Page, fixture: PlanFixture) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(fixture.userEmail);
  await page.getByLabel('Contraseña').fill(fixture.userPassword);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
}

function trackPlanBrowserIssues(page: Page) {
  const issues: string[] = [];

  const consoleHandler = (message: { type(): string; text(): string }) => {
    const text = message.text();
    if (PLAN_BROWSER_ISSUE_PATTERN.test(text)) {
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
      expect(issues, `Unexpected /plan browser issues:\n${issues.join('\n')}`).toEqual([]);
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

  feasibleFixture = await createPlanFixture({
    label: 'feasible',
    incomeAmount: 2400,
    expenseBudgetAmount: 800,
    debts: [
      {
        creditor: 'Tarjeta Principal',
        balance: 4000,
        apr: 28,
        min_payment: 220,
        type: 'CREDIT_CARD',
        due_date: 10,
      },
      {
        creditor: 'Prestamo Personal',
        balance: 9000,
        apr: 15,
        min_payment: 320,
        type: 'LOAN',
        due_date: 20,
      },
    ],
  });

  shortfallFixture = await createPlanFixture({
    label: 'shortfall',
    incomeAmount: 1200,
    expenseBudgetAmount: 300,
    debts: [
      {
        creditor: 'Tarjeta Emergencia',
        balance: 3500,
        apr: 30,
        min_payment: 450,
        type: 'CREDIT_CARD',
        due_date: 15,
      },
      {
        creditor: 'Prestamo Rapido',
        balance: 5000,
        apr: 22,
        min_payment: 420,
        type: 'LOAN',
        due_date: 24,
      },
    ],
  });
});

test.afterAll(async () => {
  await cleanupPlanFixture(feasibleFixture);
  await cleanupPlanFixture(shortfallFixture);
});

test('ruta /plan redirige a /login cuando no hay sesión', async ({ page }) => {
  await page.goto('/plan');
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
});

test('usuario con presupuesto viable puede generar su plan', async ({ page }) => {
  if (!feasibleFixture) throw new Error('Missing feasible plan fixture');

  const browserIssues = trackPlanBrowserIssues(page);
  await loginUser(page, feasibleFixture);
  await page.goto('/plan');

  await expect(page.getByRole('heading', { name: 'Selecciona tu Estrategia' })).toBeVisible();
  await expect(page.getByText(/Recomendación:/i)).toBeVisible();

  await page.getByRole('button', { name: 'Seleccionar' }).first().click();

  await expect(page.getByRole('heading', { name: 'Mi Plan de Pagos' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Registrar Pago' })).toBeVisible();
  browserIssues.expectClean();
});

test('usuario con presupuesto insuficiente ve bloqueo claro en /plan', async ({ page }) => {
  if (!shortfallFixture) throw new Error('Missing shortfall plan fixture');

  const browserIssues = trackPlanBrowserIssues(page);
  await loginUser(page, shortfallFixture);
  await page.goto('/plan');

  await expect(page.getByText(/Presupuesto insuficiente/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Seleccionar' }).first()).toBeDisabled();
  browserIssues.expectClean();
});
