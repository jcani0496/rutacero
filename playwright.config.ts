import { defineConfig } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 3200);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

// Provide a default BANK_TRANSFER_INSTRUCTIONS_JSON for E2E so the manual-transfer
// endpoint does not return 503. Real values from the user's env still take precedence.
const defaultBankInstructions = JSON.stringify([
  {
    bank: 'BI',
    accountType: 'Monetaria',
    accountNumber: 'TEST-001',
    accountName: 'RutaCero S.A. (TEST)',
  },
]);

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['line']],
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `${baseURL}/login`,
    // 240s: Sentry instrumentation + Turbopack cold start can take 60-90s in
    // resource-constrained CI runners; each playwright invocation respawns
    // (reuseExistingServer is false in CI), so we need headroom for two starts.
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      BANK_TRANSFER_INSTRUCTIONS_JSON:
        process.env.BANK_TRANSFER_INSTRUCTIONS_JSON || defaultBankInstructions,
    } as Record<string, string>,
  },
});
