import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requirePermission, createAdminClient } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/actions/admin-auth', () => ({
  requirePermission,
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient,
}));

vi.mock('@/lib/tenant/server', () => ({
  ensureCurrentTenantForUser: vi.fn(),
}));

import { clearTestData, seedTestData } from '@/lib/actions/seed-data';

describe('seed data actions authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthorized seed requests before creating the admin client', async () => {
    requirePermission.mockRejectedValueOnce(new Error('Permission denied: seed:run'));

    await expect(seedTestData('user-1')).rejects.toThrow('Permission denied: seed:run');

    expect(requirePermission).toHaveBeenCalledWith('seed:run');
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('rejects unauthorized clear requests before creating the admin client', async () => {
    requirePermission.mockRejectedValueOnce(new Error('Permission denied: seed:run'));

    await expect(clearTestData('user-1')).rejects.toThrow('Permission denied: seed:run');

    expect(requirePermission).toHaveBeenCalledWith('seed:run');
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
