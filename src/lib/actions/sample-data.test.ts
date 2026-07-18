import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUserTenant } = vi.hoisted(() => ({
  requireUserTenant: vi.fn(),
}));

vi.mock('@/lib/tenant/server', () => ({
  requireUserTenant,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/cache/next-cache', () => ({
  CACHE_TAGS: {
    USER_DEBTS: 'user-debts',
    ENGINE_PROJECTION: 'engine-projection',
    ENGINE_FORECAST: 'engine-forecast',
  },
  invalidateCacheByTag: vi.fn(),
}));

vi.mock('@/lib/insights', () => ({
  invalidateInsightsCache: vi.fn(),
}));

import { clearSampleData, seedSampleData } from '@/lib/actions/sample-data';
import { SAMPLE_DATA_PREFIX } from '@/lib/constants/sample-data';

type ChainResult = { count?: number | null; data?: unknown; error?: unknown };

/** Awaitable supabase query-builder stub: every method chains, awaiting resolves `result`. */
function chain(result: ChainResult) {
  const c: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'insert', 'delete', 'like', 'in']) {
    c[method] = vi.fn(() => c);
  }
  (c as { then: unknown }).then = (
    resolve: (value: ChainResult) => unknown,
    reject: (reason?: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return c as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<ChainResult>;
}

function mockTenant(from: ReturnType<typeof vi.fn>) {
  requireUserTenant.mockResolvedValue({
    supabase: { from },
    user: { id: 'user-1' },
    tenantId: 'tenant-1',
  });
}

describe('seedSampleData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not seed when the user already has debts', async () => {
    const countChain = chain({ count: 2, error: null });
    const from = vi.fn().mockReturnValue(countChain);
    mockTenant(from);

    const result = await seedSampleData();

    expect(result.success).toBe(false);
    expect(from).toHaveBeenCalledTimes(1);
    expect(countChain.insert).not.toHaveBeenCalled();
  });

  it('seeds tenant-scoped debts and income marked with the sample prefix', async () => {
    const countChain = chain({ count: 0, error: null });
    const debtsInsertChain = chain({ error: null });
    const incomeInsertChain = chain({ error: null });
    const from = vi
      .fn()
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(debtsInsertChain)
      .mockReturnValueOnce(incomeInsertChain);
    mockTenant(from);

    const result = await seedSampleData();

    expect(result.success).toBe(true);

    const debts = debtsInsertChain.insert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(debts).toHaveLength(3);
    for (const debt of debts) {
      expect(debt.tenant_id).toBe('tenant-1');
      expect(debt.user_id).toBe('user-1');
      expect(String(debt.notes).startsWith(SAMPLE_DATA_PREFIX)).toBe(true);
    }
    expect(debts.map((d) => d.creditor)).toEqual([
      'Tarjeta BI',
      'Préstamo Banrural',
      'Cuotas Cemaco',
    ]);

    const incomes = incomeInsertChain.insert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(incomes).toHaveLength(1);
    expect(incomes[0].tenant_id).toBe('tenant-1');
    expect(String(incomes[0].notes).startsWith(SAMPLE_DATA_PREFIX)).toBe(true);
  });
});

describe('clearSampleData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes only rows marked with the sample prefix, scoped to the tenant', async () => {
    const findChain = chain({ data: [{ id: 'debt-1' }, { id: 'debt-2' }], error: null });
    const deleteDebtsChain = chain({ error: null });
    const deleteIncomeChain = chain({ error: null });
    const from = vi
      .fn()
      .mockReturnValueOnce(findChain)
      .mockReturnValueOnce(deleteDebtsChain)
      .mockReturnValueOnce(deleteIncomeChain);
    mockTenant(from);

    const result = await clearSampleData();

    expect(result.success).toBe(true);
    expect(findChain.like).toHaveBeenCalledWith('notes', `${SAMPLE_DATA_PREFIX}%`);
    expect(deleteDebtsChain.in).toHaveBeenCalledWith('id', ['debt-1', 'debt-2']);
    expect(deleteDebtsChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(deleteIncomeChain.like).toHaveBeenCalledWith('notes', `${SAMPLE_DATA_PREFIX}%`);
    expect(deleteIncomeChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
  });
});
