import { describe, expect, it } from "vitest";

import {
  mapDebtRow,
  mapEssentialExpenseRow,
  mapForecastRow,
  mapIncomeEventRow,
  mapPaymentRow,
  mapPlanItemRow,
  mapPlanRow,
  mapVariableBudgetTargetRow,
} from "@/lib/data/mappers";

describe("data row mappers", () => {
  it("maps a Drizzle debt row to snake_case Debt", () => {
    const debt = mapDebtRow({
      id: "d1",
      userId: "u1",
      type: "CREDIT_CARD",
      creditor: "Banco",
      balance: "1500.50",
      currency: "GTQ",
      apr: "36",
      minPayment: "200",
      statementDate: 1,
      dueDate: 15,
      interestModel: "DAILY_SIMPLE",
      paymentDay: 15,
      monthlyFees: "0",
      minPaymentRule: { type: "FIXED", amount: 200 },
      nextPaymentDate: "2026-08-15",
      category: "CARD",
      installmentCount: null,
      installmentsLeft: null,
      fixedPayment: null,
      goalExtraPayment: "50",
      goalTargetDate: null,
      status: "ACTIVE",
      notes: null,
      tags: ["vip"],
      createdAt: new Date("2026-07-01T12:00:00.000Z"),
      updatedAt: new Date("2026-07-02T12:00:00.000Z"),
    });

    expect(debt).toMatchObject({
      id: "d1",
      user_id: "u1",
      min_payment: 200,
      balance: 1500.5,
      apr: 36,
      goal_extra_payment: 50,
      payment_day: 15,
      tags: ["vip"],
      created_at: "2026-07-01T12:00:00.000Z",
    });
  });

  it("maps a Drizzle payment row to snake_case Payment", () => {
    const payment = mapPaymentRow({
      id: "p1",
      userId: "u1",
      debtId: "d1",
      amount: "100.25",
      currency: "GTQ",
      paymentDate: "2026-07-20",
      method: "TRANSFER",
      createdAt: "2026-07-20T10:00:00.000Z",
      receiptUrl: null,
      receiptUploadedAt: null,
    });

    expect(payment).toEqual({
      id: "p1",
      user_id: "u1",
      debt_id: "d1",
      amount: 100.25,
      currency: "GTQ",
      payment_date: "2026-07-20",
      method: "TRANSFER",
      created_at: "2026-07-20T10:00:00.000Z",
      receipt_url: null,
      receipt_uploaded_at: null,
    });
  });

  it("maps a Drizzle plan row to snake_case Plan", () => {
    const plan = mapPlanRow({
      id: "plan1",
      userId: "u1",
      strategy: "AVALANCHE",
      engineVersion: "1.0.0",
      createdAt: new Date("2026-07-10T12:00:00.000Z"),
      active: true,
      assumptions: { monthlyBudget: 1500, currency: "GTQ" },
      horizonPeriods: 24,
      etaDebtFree: "2028-01-01",
      interestEstimate: "320.50",
      avgPayment: "450",
    });

    expect(plan).toEqual({
      id: "plan1",
      user_id: "u1",
      strategy: "AVALANCHE",
      engine_version: "1.0.0",
      created_at: "2026-07-10T12:00:00.000Z",
      active: true,
      assumptions: { monthlyBudget: 1500, currency: "GTQ" },
      horizon_periods: 24,
      eta_debt_free: "2028-01-01",
      interest_estimate: 320.5,
      avg_payment: 450,
    });
  });

  it("maps a Drizzle plan_item row with debt join", () => {
    const item = mapPlanItemRow({
      id: "pi1",
      planId: "plan1",
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      debtId: "d1",
      plannedAmount: "250.75",
      currency: "GTQ",
      priorityOrder: 1,
      isFocus: true,
      rationale: { score: 0.9 },
      debt: {
        id: "d1",
        creditor: "Banco",
        balance: "1000",
        minPayment: "200",
        apr: "36",
        type: "CREDIT_CARD",
      },
    });

    expect(item).toMatchObject({
      id: "pi1",
      plan_id: "plan1",
      planned_amount: 250.75,
      priority_order: 1,
      is_focus: true,
      debt: {
        id: "d1",
        creditor: "Banco",
        balance: 1000,
        min_payment: 200,
        apr: 36,
        type: "CREDIT_CARD",
      },
    });
  });

  it("maps a Drizzle forecast row to snake_case Forecast", () => {
    const forecast = mapForecastRow({
      id: "f1",
      userId: "u1",
      engineVersion: "1.0.0",
      createdAt: "2026-07-15T08:00:00.000Z",
      horizonPeriods: 8,
      periods: [
        {
          period_start: "2026-08-01",
          period_end: "2026-08-31",
          cash_initial: 100,
          income: 2000,
          essentials: 800,
          payments: 500,
          cash_final: 800,
          risk_level: "LOW",
        },
      ],
      maeLastPeriod: "12.5",
    });

    expect(forecast).toEqual({
      id: "f1",
      user_id: "u1",
      engine_version: "1.0.0",
      created_at: "2026-07-15T08:00:00.000Z",
      horizon_periods: 8,
      periods: [
        {
          period_start: "2026-08-01",
          period_end: "2026-08-31",
          cash_initial: 100,
          income: 2000,
          essentials: 800,
          payments: 500,
          cash_final: 800,
          risk_level: "LOW",
        },
      ],
      mae_last_period: 12.5,
    });
  });

  it("maps a Drizzle income_events row to snake_case Income", () => {
    const income = mapIncomeEventRow({
      id: "i1",
      userId: "u1",
      date: "2026-07-01",
      amount: "4500.25",
      currency: "GTQ",
      type: "FIXED",
      source: "Salario",
      notes: null,
      createdAt: new Date("2026-07-01T12:00:00.000Z"),
    });

    expect(income).toEqual({
      id: "i1",
      user_id: "u1",
      date: "2026-07-01",
      amount: 4500.25,
      currency: "GTQ",
      type: "FIXED",
      source: "Salario",
      notes: null,
      created_at: "2026-07-01T12:00:00.000Z",
    });
  });

  it("maps a Drizzle essential_expenses row to snake_case Expense", () => {
    const expense = mapEssentialExpenseRow({
      id: "e1",
      userId: "u1",
      name: "Renta",
      amount: "2000",
      frequency: "MONTHLY",
      nextDate: "2026-08-01",
      currency: "GTQ",
      createdAt: "2026-07-01T12:00:00.000Z",
      expenseType: "NEED",
      category: "HOUSING",
      budgetAmount: "2000",
      actualAmount: "1950.5",
    });

    expect(expense).toEqual({
      id: "e1",
      user_id: "u1",
      name: "Renta",
      amount: 2000,
      frequency: "MONTHLY",
      next_date: "2026-08-01",
      currency: "GTQ",
      created_at: "2026-07-01T12:00:00.000Z",
      expense_type: "NEED",
      category: "HOUSING",
      budget_amount: 2000,
      actual_amount: 1950.5,
    });
  });

  it("maps a Drizzle variable_budget_targets row to snake_case BudgetTarget", () => {
    const target = mapVariableBudgetTargetRow({
      id: "b1",
      userId: "u1",
      category: "FOOD",
      amount: "800",
      actualAmount: "650.75",
      period: "MONTHLY",
      currency: "GTQ",
      createdAt: new Date("2026-07-05T09:00:00.000Z"),
    });

    expect(target).toEqual({
      id: "b1",
      user_id: "u1",
      category: "FOOD",
      amount: 800,
      actual_amount: 650.75,
      period: "MONTHLY",
      currency: "GTQ",
      created_at: "2026-07-05T09:00:00.000Z",
    });
  });
});
