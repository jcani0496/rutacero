/**
 * Resolve the next suggested payment from an active plan's items.
 * Used by plan → payments handoff ("Registrar este pago").
 */

export type PlanPaymentHint = {
  debtId: string;
  suggestedAmount: number;
  periodStart: string;
  creditor?: string;
};

type PlanItemLike = {
  debt_id: string;
  planned_amount: number;
  period_start: string;
  period_end: string;
  is_focus?: boolean;
  debt?: { creditor?: string | null } | null;
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Pick the current (or next upcoming) period, then the focus debt within it.
 */
export function resolveNextPlanPayment(
  items: PlanItemLike[] | null | undefined,
  focusDebtId?: string | null,
): PlanPaymentHint | null {
  if (!items || items.length === 0) return null;

  const today = startOfDay(new Date());
  const periodKeys = new Map<string, PlanItemLike[]>();

  for (const item of items) {
    const key = `${item.period_start}|${item.period_end}`;
    const list = periodKeys.get(key);
    if (list) list.push(item);
    else periodKeys.set(key, [item]);
  }

  const periods = Array.from(periodKeys.entries())
    .map(([key, periodItems]) => {
      const [periodStart, periodEnd] = key.split('|');
      return { periodStart, periodEnd, items: periodItems };
    })
    .sort(
      (a, b) =>
        new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime(),
    );

  const currentOrNext =
    periods.find((p) => startOfDay(new Date(p.periodEnd)) >= today) ??
    periods[periods.length - 1];

  if (!currentOrNext || currentOrNext.items.length === 0) return null;

  const focus =
    currentOrNext.items.find((item) => item.debt_id === focusDebtId) ||
    currentOrNext.items.find((item) => item.is_focus) ||
    currentOrNext.items.reduce((max, item) =>
      Number(item.planned_amount) > Number(max.planned_amount) ? item : max,
    );

  const amount = Math.round(Number(focus.planned_amount));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    debtId: focus.debt_id,
    suggestedAmount: amount,
    periodStart: currentOrNext.periodStart,
    creditor: focus.debt?.creditor ?? undefined,
  };
}

export type PlanPaymentCoverage = 'covers' | 'ahead' | 'short';

/**
 * Compare a recorded payment to the plan's suggested amount for that debt.
 * Tolerance: within 2% or Q1 counts as "cubre".
 */
export function classifyPlanPaymentCoverage(
  paidAmount: number,
  suggestedAmount: number,
): PlanPaymentCoverage {
  if (!Number.isFinite(paidAmount) || !Number.isFinite(suggestedAmount) || suggestedAmount <= 0) {
    return 'covers';
  }
  const tolerance = Math.max(1, suggestedAmount * 0.02);
  if (paidAmount >= suggestedAmount + tolerance) return 'ahead';
  if (paidAmount + tolerance >= suggestedAmount) return 'covers';
  return 'short';
}

export function planCoverageCopy(coverage: PlanPaymentCoverage): {
  title: string;
  description: string;
} {
  switch (coverage) {
    case 'ahead':
      return {
        title: 'Este pago adelanta tu plan',
        description: 'Pagaste más de lo sugerido. Vas un paso adelante en tu ruta.',
      };
    case 'short':
      return {
        title: 'Este pago no cubre del todo tu plan',
        description: 'Quedó por debajo de lo sugerido. Podés completar el resto cuando puedas.',
      };
    default:
      return {
        title: 'Este pago cubre tu plan',
        description: 'Registraste el monto sugerido para este período. ¡Seguí así!',
      };
  }
}
