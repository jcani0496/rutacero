import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireUserTenant: vi.fn(),
}));

vi.mock('@/lib/tenant/server', () => ({
  requireUserTenant: mocks.requireUserTenant,
}));

import { QuickActionsWrapper } from './quick-actions-wrapper';

type QueryResult = {
  count?: number | null;
  data?: unknown;
};

function createQuery(result: QueryResult) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve(result)),
    then: (onFulfilled?: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
    finally: (onFinally?: (() => void) | null | undefined) => Promise.resolve(result).finally(onFinally),
  };

  return query;
}

function createSupabaseMock({
  activePlan,
  debtCount,
}: {
  activePlan: { strategy: string } | null;
  debtCount: number;
}) {
  return {
    from: (table: string) => {
      if (table === 'plans') {
        return createQuery({ data: activePlan });
      }

      if (table === 'debts') {
        return createQuery({ count: debtCount });
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe('QuickActionsWrapper', () => {
  beforeEach(() => {
    mocks.requireUserTenant.mockReset();
  });

  it('routes the first-plan CTA to the live /plan flow', async () => {
    mocks.requireUserTenant.mockResolvedValue({
      supabase: createSupabaseMock({
        activePlan: null,
        debtCount: 2,
      }),
      user: { id: 'user-123' },
      tenantId: 'tenant-123',
    });

    render(await QuickActionsWrapper());

    expect(screen.getByRole('link', { name: /genera tu primer plan/i })).toHaveAttribute(
      'href',
      '/plan'
    );
  });
});
