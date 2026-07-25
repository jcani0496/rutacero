import { describe, expect, it } from 'vitest';
import {
  classifyPlanPaymentCoverage,
  planCoverageCopy,
  resolveNextPlanPayment,
} from '../next-payment';

describe('resolveNextPlanPayment', () => {
  const base = {
    period_start: '2026-07-01',
    period_end: '2026-07-31',
  };

  it('picks focus debt in the current period', () => {
    const hint = resolveNextPlanPayment(
      [
        {
          ...base,
          debt_id: 'a',
          planned_amount: 200,
          is_focus: false,
          debt: { creditor: 'Banco A' },
        },
        {
          ...base,
          debt_id: 'b',
          planned_amount: 500,
          is_focus: true,
          debt: { creditor: 'Tarjeta B' },
        },
      ],
      null,
    );

    expect(hint).toEqual({
      debtId: 'b',
      suggestedAmount: 500,
      periodStart: '2026-07-01',
      creditor: 'Tarjeta B',
    });
  });

  it('honors focusDebtId over is_focus', () => {
    const hint = resolveNextPlanPayment(
      [
        {
          ...base,
          debt_id: 'a',
          planned_amount: 200,
          is_focus: true,
        },
        {
          ...base,
          debt_id: 'b',
          planned_amount: 500,
          is_focus: false,
        },
      ],
      'a',
    );

    expect(hint?.debtId).toBe('a');
    expect(hint?.suggestedAmount).toBe(200);
  });
});

describe('classifyPlanPaymentCoverage', () => {
  it('detects covers / ahead / short', () => {
    expect(classifyPlanPaymentCoverage(500, 500)).toBe('covers');
    expect(classifyPlanPaymentCoverage(505, 500)).toBe('covers');
    expect(classifyPlanPaymentCoverage(600, 500)).toBe('ahead');
    expect(classifyPlanPaymentCoverage(400, 500)).toBe('short');
  });
});

describe('planCoverageCopy', () => {
  it('returns vos-friendly copy', () => {
    expect(planCoverageCopy('ahead').title).toMatch(/adelanta/);
    expect(planCoverageCopy('covers').title).toMatch(/cubre/);
    expect(planCoverageCopy('short').description).toMatch(/Podés/);
  });
});
