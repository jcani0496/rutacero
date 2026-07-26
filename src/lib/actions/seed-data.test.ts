import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requirePermission, getDb } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock('@/lib/actions/admin-auth', () => ({
  requirePermission,
}));

vi.mock('@/db/client', () => ({
  getDb,
  schema: {},
}));

vi.mock('@/lib/tenant/server', () => ({
  ensureCurrentTenantForUser: vi.fn(),
}));

import { clearTestData, seedTestData } from '@/lib/actions/seed-data';

describe('seed data actions authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthorized seed requests before touching the database', async () => {
    requirePermission.mockRejectedValueOnce(new Error('Permission denied: seed:run'));

    await expect(seedTestData('user-1')).rejects.toThrow('Permission denied: seed:run');

    expect(requirePermission).toHaveBeenCalledWith('seed:run');
    expect(getDb).not.toHaveBeenCalled();
  });

  it('rejects unauthorized clear requests before touching the database', async () => {
    requirePermission.mockRejectedValueOnce(new Error('Permission denied: seed:run'));

    await expect(clearTestData('user-1')).rejects.toThrow('Permission denied: seed:run');

    expect(requirePermission).toHaveBeenCalledWith('seed:run');
    expect(getDb).not.toHaveBeenCalled();
  });
});
