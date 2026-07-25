import type { Debt, Payment, Currency, DebtStatus, DebtType, DebtInterestModel, DebtMinPaymentRule } from "@/types";

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
