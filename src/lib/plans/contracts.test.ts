import { describe, expect, it } from 'vitest';
import {
  computeEffectiveMonthlyBudget,
  createBudgetShortfallIssue,
} from './contracts';

describe('plan contracts', () => {
  it('computes effective budget after applying safety buffer', () => {
    expect(
      computeEffectiveMonthlyBudget({
        rawMonthlyBudget: 1000,
        totalMinPayments: 850,
        safetyBufferPct: 10,
      })
    ).toEqual({
      effectiveBudget: 900,
      feasible: true,
    });
  });

  it('clamps invalid safety buffers before checking feasibility', () => {
    expect(
      computeEffectiveMonthlyBudget({
        rawMonthlyBudget: 1000,
        totalMinPayments: 600,
        safetyBufferPct: 80,
      })
    ).toEqual({
      effectiveBudget: 500,
      feasible: false,
    });
  });

  it('creates a stable shortfall issue payload for UI consumers', () => {
    expect(
      createBudgetShortfallIssue({
        effectiveBudget: 455.555,
        requiredMinPayments: 600.666,
        safetyBufferPct: 12.4,
      })
    ).toEqual({
      kind: 'BUDGET_SHORTFALL',
      effectiveBudget: 455.56,
      requiredMinPayments: 600.67,
      safetyBufferPct: 12.4,
    });
  });
});
