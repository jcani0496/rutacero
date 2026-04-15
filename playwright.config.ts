import { defineConfig } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 3200);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

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
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
