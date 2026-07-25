import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// Cleanup after each test case
afterEach(() => {
  cleanup();
});

// Set up environment variables for testing
(process.env as Record<string, string | undefined>).NODE_ENV = 'test';

// Unit tests still mock the legacy Supabase clients. Keep the dual-path
// switches on the supabase side in Vitest so existing mocks keep working.
// Runtime/CI e2e defaults remain drizzle/better-auth/railway (see providers).
process.env.DATA_PROVIDER ||= 'supabase';
process.env.AUTH_PROVIDER ||= 'supabase';
process.env.NEXT_PUBLIC_AUTH_PROVIDER ||= 'supabase';
process.env.STORAGE_PROVIDER ||= 'supabase';
process.env.NEXT_PUBLIC_STORAGE_PROVIDER ||= 'supabase';
