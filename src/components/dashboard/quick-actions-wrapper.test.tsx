import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getActivePlan: vi.fn(),
  getDebtStats: vi.fn(),
}));

vi.mock('@/lib/actions/plans', () => ({
  getActivePlan: mocks.getActivePlan,
}));

vi.mock('@/lib/actions/debts', () => ({
  getDebtStats: mocks.getDebtStats,
}));

import { QuickActionsWrapper } from './quick-actions-wrapper';

describe('QuickActionsWrapper', () => {
  beforeEach(() => {
    mocks.getActivePlan.mockReset();
    mocks.getDebtStats.mockReset();
  });

  it('routes the first-plan CTA to the live /plan flow', async () => {
    mocks.getActivePlan.mockResolvedValue(null);
    mocks.getDebtStats.mockResolvedValue({
      totalBalance: 1000,
      totalMinPayment: 100,
      averageApr: 20,
      debtCount: 2,
    });

    render(await QuickActionsWrapper());

    expect(screen.getByRole('link', { name: /genera tu primer plan/i })).toHaveAttribute(
      'href',
      '/plan'
    );
  });
});
