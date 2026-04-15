export interface BudgetShortfallIssue {
  kind: 'BUDGET_SHORTFALL';
  effectiveBudget: number;
  requiredMinPayments: number;
  safetyBufferPct: number;
}

export interface EffectiveMonthlyBudgetInput {
  rawMonthlyBudget: number;
  totalMinPayments: number;
  safetyBufferPct: number;
}

export interface EffectiveMonthlyBudgetResult {
  effectiveBudget: number;
  feasible: boolean;
}

export type ComparisonResult<T> =
  | { ok: true; data: T }
  | { ok: false; issue: BudgetShortfallIssue };

export function computeEffectiveMonthlyBudget(
  params: EffectiveMonthlyBudgetInput
): EffectiveMonthlyBudgetResult {
  const raw = Math.max(0, Number(params.rawMonthlyBudget || 0));
  const bufferPct = Math.max(0, Math.min(50, Number(params.safetyBufferPct || 0)));
  const effectiveBudget = raw * (1 - bufferPct / 100);
  const requiredMinPayments = Math.max(0, Number(params.totalMinPayments || 0));

  return {
    effectiveBudget,
    feasible: effectiveBudget >= requiredMinPayments,
  };
}

export function createBudgetShortfallIssue(params: {
  effectiveBudget: number;
  requiredMinPayments: number;
  safetyBufferPct: number;
}): BudgetShortfallIssue {
  return {
    kind: 'BUDGET_SHORTFALL',
    effectiveBudget: Math.round(Number(params.effectiveBudget) * 100) / 100,
    requiredMinPayments: Math.round(Number(params.requiredMinPayments) * 100) / 100,
    safetyBufferPct: Math.max(0, Math.min(50, Number(params.safetyBufferPct || 0))),
  };
}
