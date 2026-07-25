import { describe, expect, it } from "vitest";

import { mapDebtRow, mapPaymentRow } from "@/lib/data/mappers";

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
});
