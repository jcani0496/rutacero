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
