import type {
  Debt,
  Payment,
  Plan,
  PlanItem,
  Forecast,
  ForecastPeriod,
  Currency,
  DebtStatus,
  DebtType,
  DebtInterestModel,
  DebtMinPaymentRule,
  PlanStrategy,
  IncomeEvent,
  EssentialExpense,
  VariableBudgetTarget,
} from "@/types";

/** Income UI row — base IncomeEvent plus optional source from income_events. */
export type IncomeMapped = IncomeEvent & { source?: string | null };

/** Expense UI row — base EssentialExpense plus categorization fields. */
export type ExpenseMapped = EssentialExpense & {
  expense_type?: "NEED" | "WANT" | null;
  category?: string | null;
  budget_amount?: number | null;
  actual_amount?: number | null;
};

/** Drizzle debt row shape (camelCase) used at the action boundary. */
export type DebtRow = {
  id: string;
  userId: string;
  type: string;
  creditor: string;
  balance: string | number;
  currency: string;
  apr: string | number | null;
  minPayment: string | number;
  statementDate: number | null;
  dueDate: number | null;
  interestModel: string | null;
  paymentDay: number | null;
  monthlyFees: string | number | null;
  minPaymentRule: unknown;
  nextPaymentDate: string;
  category: string | null;
  installmentCount: number | null;
  installmentsLeft: number | null;
  fixedPayment: string | number | null;
  goalExtraPayment: string | number | null;
  goalTargetDate: string | null;
  status: string;
  notes: string | null;
  tags: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
};

/** Drizzle payment row shape (camelCase). */
export type PaymentRow = {
  id: string;
  userId: string;
  debtId: string;
  amount: string | number;
  currency: string;
  paymentDate: string;
  method: string | null;
  createdAt: Date | string;
  receiptUrl?: string | null;
  receiptUploadedAt?: Date | string | null;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

function toNumberOrNull(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

/**
 * Maps a Drizzle camelCase debt row to the snake_case `Debt` UI contract.
 */
export function mapDebtRow(row: DebtRow): Debt {
  return {
    id: row.id,
    user_id: row.userId,
    type: row.type as DebtType,
    creditor: row.creditor,
    balance: toNumber(row.balance),
    currency: row.currency as Currency,
    apr: toNumberOrNull(row.apr),
    min_payment: toNumber(row.minPayment),
    statement_date: row.statementDate,
    due_date: row.dueDate,
    interest_model: (row.interestModel as DebtInterestModel | null) ?? null,
    payment_day: row.paymentDay,
    monthly_fees: toNumberOrNull(row.monthlyFees),
    min_payment_rule: (row.minPaymentRule as DebtMinPaymentRule | null) ?? null,
    next_payment_date: row.nextPaymentDate,
    category: row.category,
    installment_count: row.installmentCount,
    installments_left: row.installmentsLeft,
    fixed_payment: toNumberOrNull(row.fixedPayment),
    goal_extra_payment: toNumberOrNull(row.goalExtraPayment),
    goal_target_date: row.goalTargetDate,
    status: row.status as DebtStatus,
    notes: row.notes,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
  };
}

/**
 * Maps a Drizzle camelCase payment row to the snake_case `Payment` UI contract.
 */
export function mapPaymentRow(row: PaymentRow): Payment {
  return {
    id: row.id,
    user_id: row.userId,
    debt_id: row.debtId,
    amount: toNumber(row.amount),
    currency: row.currency as Currency,
    payment_date: row.paymentDate,
    method: row.method,
    created_at: toIso(row.createdAt),
    receipt_url: row.receiptUrl ?? null,
    receipt_uploaded_at: row.receiptUploadedAt
      ? toIso(row.receiptUploadedAt)
      : null,
  };
}

/** Drizzle plan row shape (camelCase). */
export type PlanRow = {
  id: string;
  userId: string;
  strategy: string;
  engineVersion: string;
  createdAt: Date | string;
  active: boolean;
  assumptions: unknown;
  horizonPeriods: number;
  etaDebtFree: string;
  interestEstimate: string | number;
  avgPayment: string | number;
};

/** Drizzle plan_item row shape (camelCase), with optional debt join. */
export type PlanItemRow = {
  id: string;
  planId: string;
  periodStart: string;
  periodEnd: string;
  debtId: string;
  plannedAmount: string | number;
  currency: string;
  priorityOrder: number;
  isFocus: boolean;
  rationale: unknown;
  debt?: {
    id: string;
    creditor: string;
    balance: string | number;
    minPayment: string | number;
    apr: string | number | null;
    type: string;
  } | null;
};

/** Drizzle forecast row shape (camelCase). */
export type ForecastRow = {
  id: string;
  userId: string;
  engineVersion: string;
  createdAt: Date | string;
  horizonPeriods: number;
  periods: unknown;
  maeLastPeriod: string | number | null;
};

/**
 * Maps a Drizzle camelCase plan row to the snake_case `Plan` UI contract.
 */
export function mapPlanRow(row: PlanRow): Plan {
  return {
    id: row.id,
    user_id: row.userId,
    strategy: row.strategy as PlanStrategy,
    engine_version: row.engineVersion,
    created_at: toIso(row.createdAt),
    active: row.active,
    assumptions: (row.assumptions ?? {}) as Plan["assumptions"],
    horizon_periods: row.horizonPeriods,
    eta_debt_free: row.etaDebtFree,
    interest_estimate: toNumber(row.interestEstimate),
    avg_payment: toNumber(row.avgPayment),
  };
}

/**
 * Maps a Drizzle camelCase plan_item row to the snake_case `PlanItem` UI contract.
 */
export function mapPlanItemRow(row: PlanItemRow): PlanItem {
  const item: PlanItem = {
    id: row.id,
    plan_id: row.planId,
    period_start: row.periodStart,
    period_end: row.periodEnd,
    debt_id: row.debtId,
    planned_amount: toNumber(row.plannedAmount),
    currency: row.currency as Currency,
    priority_order: row.priorityOrder,
    is_focus: row.isFocus,
    rationale: (row.rationale ?? {}) as PlanItem["rationale"],
  };

  if (row.debt) {
    item.debt = {
      id: row.debt.id,
      creditor: row.debt.creditor,
      balance: toNumber(row.debt.balance),
      min_payment: toNumber(row.debt.minPayment),
      apr: toNumberOrNull(row.debt.apr),
      type: row.debt.type as DebtType,
    };
  }

  return item;
}

/**
 * Maps a Drizzle camelCase forecast row to the snake_case `Forecast` UI contract.
 */
export function mapForecastRow(row: ForecastRow): Forecast {
  return {
    id: row.id,
    user_id: row.userId,
    engine_version: row.engineVersion,
    created_at: toIso(row.createdAt),
    horizon_periods: row.horizonPeriods,
    periods: Array.isArray(row.periods)
      ? (row.periods as ForecastPeriod[])
      : [],
    mae_last_period: toNumberOrNull(row.maeLastPeriod),
  };
}

/** Drizzle income_events row shape (camelCase). */
export type IncomeEventRow = {
  id: string;
  userId: string;
  date: string;
  amount: string | number;
  currency: string;
  type: string;
  source?: string | null;
  notes: string | null;
  createdAt: Date | string;
};

/** Drizzle essential_expenses row shape (camelCase). */
export type EssentialExpenseRow = {
  id: string;
  userId: string;
  name: string;
  amount: string | number;
  frequency: string;
  nextDate: string;
  currency: string;
  createdAt: Date | string;
  expenseType?: string | null;
  category?: string | null;
  budgetAmount?: string | number | null;
  actualAmount?: string | number | null;
};

/** Drizzle variable_budget_targets row shape (camelCase). */
export type VariableBudgetTargetRow = {
  id: string;
  userId: string;
  category: string;
  amount: string | number;
  actualAmount: string | number;
  period: string;
  currency: string;
  createdAt: Date | string;
};

/**
 * Maps a Drizzle camelCase income_events row to the snake_case Income UI contract.
 */
export function mapIncomeEventRow(row: IncomeEventRow): IncomeMapped {
  return {
    id: row.id,
    user_id: row.userId,
    date: row.date,
    amount: toNumber(row.amount),
    currency: row.currency as Currency,
    type: row.type as IncomeEvent["type"],
    source: row.source ?? undefined,
    notes: row.notes,
    created_at: toIso(row.createdAt),
  };
}

/**
 * Maps a Drizzle camelCase essential_expenses row to the snake_case Expense UI contract.
 */
export function mapEssentialExpenseRow(row: EssentialExpenseRow): ExpenseMapped {
  return {
    id: row.id,
    user_id: row.userId,
    name: row.name,
    amount: toNumber(row.amount),
    frequency: row.frequency as EssentialExpense["frequency"],
    next_date: row.nextDate,
    currency: row.currency as Currency,
    created_at: toIso(row.createdAt),
    expense_type:
      row.expenseType === "WANT" || row.expenseType === "NEED"
        ? row.expenseType
        : null,
    category: row.category ?? null,
    budget_amount: toNumberOrNull(row.budgetAmount),
    actual_amount: toNumberOrNull(row.actualAmount),
  };
}

/**
 * Maps a Drizzle camelCase variable_budget_targets row to snake_case UI contract.
 */
export function mapVariableBudgetTargetRow(
  row: VariableBudgetTargetRow,
): VariableBudgetTarget {
  return {
    id: row.id,
    user_id: row.userId,
    category: row.category,
    amount: toNumber(row.amount),
    actual_amount: toNumber(row.actualAmount),
    period: row.period as VariableBudgetTarget["period"],
    currency: row.currency as Currency,
    created_at: toIso(row.createdAt),
  };
}
