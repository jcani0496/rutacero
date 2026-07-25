import { describe, expect, it } from "vitest";

import {
  mapAdminReplyTemplateRow,
  mapAdminSupportRuleRow,
  mapAdminSupportSettingsRow,
  mapAlertRow,
  mapBillingEntitlementRow,
  mapDebtRow,
  mapEssentialExpenseRow,
  mapForecastRow,
  mapIncomeEventRow,
  mapLifecycleTouchpointRow,
  mapManualPaymentGrantRow,
  mapPaymentRow,
  mapPaymentWebhookEventRow,
  mapPendingManualTransferRow,
  mapPlanItemRow,
  mapPlanRow,
  mapRecurrenteCheckoutContextRow,
  mapSubscriptionRow,
  mapSupportTicketRow,
  mapTicketMessageRow,
  mapUserNotificationRow,
  mapUserProfileRow,
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

  it("maps a Drizzle user_profiles row to snake_case profile contract", () => {
    const profile = mapUserProfileRow({
      id: "p1",
      userId: "u1",
      currencyBase: "USD",
      payFrequency: "MONTHLY",
      payDates: [1],
      goalType: "FASTEST",
      timezone: "America/Guatemala",
      onboardingCompleted: true,
      createdAt: new Date("2026-07-01T12:00:00.000Z"),
      updatedAt: "2026-07-02T12:00:00.000Z",
      lastActiveAt: null,
      currentTenantId: "t1",
      motivationLevel: 4,
      riskTolerance: 2,
      safetyBufferPct: "12.5",
      onboardingMotivation: "STRESSED",
    });

    expect(profile).toEqual({
      id: "p1",
      user_id: "u1",
      currency_base: "USD",
      pay_frequency: "MONTHLY",
      pay_dates: [1],
      goal_type: "FASTEST",
      timezone: "America/Guatemala",
      motivation_level: 4,
      risk_tolerance: 2,
      safety_buffer_pct: 12.5,
      created_at: "2026-07-01T12:00:00.000Z",
      updated_at: "2026-07-02T12:00:00.000Z",
      onboarding_completed: true,
      current_tenant_id: "t1",
      onboarding_motivation: "STRESSED",
      last_active_at: null,
    });
  });

  it("maps a Drizzle user_notifications row to snake_case notification contract", () => {
    const notification = mapUserNotificationRow({
      id: "n1",
      type: "PAYMENT_DUE",
      severity: "CRITICAL",
      title: "Pago vence hoy",
      message: "Hoy vence Banco",
      read: false,
      createdAt: new Date("2026-07-20T08:00:00.000Z"),
      metadata: { notification_key: "due:d1", debt_id: "d1" },
    });

    expect(notification).toEqual({
      id: "n1",
      type: "PAYMENT_DUE",
      severity: "CRITICAL",
      title: "Pago vence hoy",
      message: "Hoy vence Banco",
      read: false,
      created_at: "2026-07-20T08:00:00.000Z",
      metadata: { notification_key: "due:d1", debt_id: "d1" },
    });
  });

  it("maps a Drizzle lifecycle_touchpoints row to snake_case", () => {
    const touchpoint = mapLifecycleTouchpointRow({
      id: "tp1",
      tenantId: "t1",
      userId: "u1",
      campaignKey: "OVERDUE_NUDGE",
      channel: "IN_APP",
      status: "SENT",
      dedupeKey: "overdue-nudge:2026-07-20",
      metadata: { overdue_count: 1 },
      triggeredAt: new Date("2026-07-20T09:00:00.000Z"),
      deliveredAt: "2026-07-20T09:01:00.000Z",
      createdAt: new Date("2026-07-20T09:00:00.000Z"),
      updatedAt: new Date("2026-07-20T09:01:00.000Z"),
    });

    expect(touchpoint).toEqual({
      id: "tp1",
      tenant_id: "t1",
      user_id: "u1",
      campaign_key: "OVERDUE_NUDGE",
      channel: "IN_APP",
      status: "SENT",
      dedupe_key: "overdue-nudge:2026-07-20",
      metadata: { overdue_count: 1 },
      triggered_at: "2026-07-20T09:00:00.000Z",
      delivered_at: "2026-07-20T09:01:00.000Z",
      created_at: "2026-07-20T09:00:00.000Z",
      updated_at: "2026-07-20T09:01:00.000Z",
    });
  });

  it("maps a Drizzle alerts row to snake_case legacy alert contract", () => {
    const alert = mapAlertRow({
      id: "a1",
      userId: "u1",
      type: "PAYMENT_DUE",
      severity: "HIGH",
      periodStart: "2026-07-01",
      message: "Pago próximo",
      status: "ACTIVE",
      createdAt: new Date("2026-07-01T12:00:00.000Z"),
      sentAt: null,
      tenantId: "t1",
    });

    expect(alert).toEqual({
      id: "a1",
      user_id: "u1",
      type: "PAYMENT_DUE",
      severity: "HIGH",
      period_start: "2026-07-01",
      message: "Pago próximo",
      status: "ACTIVE",
      created_at: "2026-07-01T12:00:00.000Z",
      sent_at: null,
      tenant_id: "t1",
    });
  });

  it("maps a Drizzle support_tickets row to snake_case ticket contract", () => {
    const ticket = mapSupportTicketRow({
      id: "tkt1",
      userId: "u1",
      subject: "No puedo pagar",
      description: "Detalle del problema",
      body: "Detalle del problema",
      status: "OPEN",
      priority: "HIGH",
      category: "BILLING",
      createdAt: new Date("2026-07-20T10:00:00.000Z"),
      updatedAt: new Date("2026-07-20T11:00:00.000Z"),
      resolvedAt: null,
      assignedAdminId: "adm1",
      tenantId: "ten1",
    });

    expect(ticket).toEqual({
      id: "tkt1",
      user_id: "u1",
      subject: "No puedo pagar",
      description: "Detalle del problema",
      status: "OPEN",
      priority: "HIGH",
      category: "BILLING",
      created_at: "2026-07-20T10:00:00.000Z",
      updated_at: "2026-07-20T11:00:00.000Z",
      resolved_at: null,
      assigned_admin_id: "adm1",
      tenant_id: "ten1",
    });
  });

  it("maps a Drizzle ticket_messages row to snake_case", () => {
    const message = mapTicketMessageRow({
      id: "m1",
      ticketId: "tkt1",
      senderType: "ADMIN",
      senderId: "adm1",
      message: "Hola, te ayudamos",
      isInternal: false,
      createdAt: new Date("2026-07-20T12:00:00.000Z"),
    });

    expect(message).toEqual({
      id: "m1",
      ticket_id: "tkt1",
      sender_type: "ADMIN",
      sender_id: "adm1",
      message: "Hola, te ayudamos",
      is_internal: false,
      created_at: "2026-07-20T12:00:00.000Z",
    });
  });

  it("maps Drizzle admin support settings/rules/templates to snake_case", () => {
    expect(
      mapAdminSupportSettingsRow({
        id: "s1",
        autoAssignEnabled: true,
        autoAssignStrategy: "LOAD_BALANCED",
        autoAssignPriorities: ["URGENT", "HIGH"],
        lastRoundRobinIndex: 2,
        slaEscalationEnabled: true,
        staleReassignEnabled: false,
        staleReassignHours: 12,
        updatedAt: new Date("2026-07-20T13:00:00.000Z"),
      }),
    ).toEqual({
      id: "s1",
      auto_assign_enabled: true,
      auto_assign_strategy: "LOAD_BALANCED",
      auto_assign_priorities: ["URGENT", "HIGH"],
      last_round_robin_index: 2,
      sla_escalation_enabled: true,
      stale_reassign_enabled: false,
      stale_reassign_hours: 12,
      updated_at: "2026-07-20T13:00:00.000Z",
    });

    expect(
      mapAdminSupportRuleRow({
        id: "r1",
        name: "Billing high",
        isActive: true,
        category: "BILLING",
        planCode: "PRO",
        setPriority: "HIGH",
        assignRole: "SUPPORT",
        createdAt: new Date("2026-07-20T14:00:00.000Z"),
        updatedAt: new Date("2026-07-20T14:30:00.000Z"),
      }),
    ).toMatchObject({
      id: "r1",
      name: "Billing high",
      is_active: true,
      category: "BILLING",
      plan_code: "PRO",
      set_priority: "HIGH",
      assign_role: "SUPPORT",
    });

    expect(
      mapAdminReplyTemplateRow({
        id: "tpl1",
        title: "Saludo",
        body: "Hola {{name}}",
        isActive: true,
        createdAt: new Date("2026-07-20T15:00:00.000Z"),
        updatedAt: new Date("2026-07-20T15:00:00.000Z"),
        createdBy: "adm1",
      }),
    ).toMatchObject({
      id: "tpl1",
      title: "Saludo",
      body: "Hola {{name}}",
      is_active: true,
      created_by: "adm1",
    });
  });

  it("maps billing/funnel rows to snake_case contracts", () => {
    expect(
      mapSubscriptionRow({
        id: "sub1",
        userId: "u1",
        planCode: "PRO",
        status: "ACTIVE",
        provider: "recurrente",
        externalId: "ext-1",
        renewAt: new Date("2026-08-25T00:00:00.000Z"),
        tenantId: "t1",
        purchaserUserId: "u1",
        attributionId: "attr-1",
        marketingContext: { source: "ads" },
        billingInterval: "monthly",
        priceAmountQ: "99.00",
        paymentMethod: "recurrente",
      }),
    ).toMatchObject({
      id: "sub1",
      user_id: "u1",
      plan_code: "PRO",
      status: "ACTIVE",
      external_id: "ext-1",
      tenant_id: "t1",
      purchaser_user_id: "u1",
      attribution_id: "attr-1",
      marketing_context: { source: "ads" },
      billing_interval: "monthly",
      price_amount_q: 99,
      payment_method: "recurrente",
    });

    expect(
      mapBillingEntitlementRow({
        id: "be1",
        tenantId: "t1",
        userId: "u1",
        provider: "google_play",
        platform: "android",
        productId: "pro_pass",
        purchaseToken: "tok",
        orderId: "ord",
        status: "ACTIVE",
        grantedAt: new Date("2026-07-01T00:00:00.000Z"),
        expiresAt: new Date("2026-09-29T00:00:00.000Z"),
        lastVerifiedAt: new Date("2026-07-25T00:00:00.000Z"),
        rawResponse: { ok: true },
      }),
    ).toMatchObject({
      id: "be1",
      tenant_id: "t1",
      user_id: "u1",
      provider: "google_play",
      purchase_token: "tok",
      granted_at: "2026-07-01T00:00:00.000Z",
      expires_at: "2026-09-29T00:00:00.000Z",
      raw_response: { ok: true },
    });

    expect(
      mapRecurrenteCheckoutContextRow({
        checkoutId: "chk1",
        tenantId: "t1",
        purchaserUserId: "u1",
        planCode: "PRO",
        attributionId: "attr",
        marketingContext: { path: "/checkout" },
      }),
    ).toEqual({
      checkout_id: "chk1",
      tenant_id: "t1",
      purchaser_user_id: "u1",
      plan_code: "PRO",
      attribution_id: "attr",
      marketing_context: { path: "/checkout" },
    });

    expect(
      mapPaymentWebhookEventRow({
        id: "wh1",
        provider: "recurrente",
        externalEventId: "evt1",
        receivedAt: new Date("2026-07-25T12:00:00.000Z"),
        payload: { type: "payment_intent.succeeded" },
        processed: true,
        error: null,
      }),
    ).toEqual({
      id: "wh1",
      provider: "recurrente",
      external_event_id: "evt1",
      received_at: "2026-07-25T12:00:00.000Z",
      payload: { type: "payment_intent.succeeded" },
      processed: true,
      error: null,
    });

    expect(
      mapManualPaymentGrantRow({
        id: "g1",
        tenantId: "t1",
        grantedByAdminId: "a1",
        variantCode: "PRO_MONTHLY",
        priceAmountQ: "99",
        bankReference: "BI-1",
        durationDays: 30,
        expiresAt: new Date("2026-08-25T00:00:00.000Z"),
        notes: null,
        createdAt: new Date("2026-07-25T00:00:00.000Z"),
      }),
    ).toMatchObject({
      id: "g1",
      tenant_id: "t1",
      bank_reference: "BI-1",
      price_amount_q: 99,
      duration_days: 30,
    });

    expect(
      mapPendingManualTransferRow({
        id: "pmt1",
        tenantId: "t1",
        userId: "u1",
        variantCode: "PRO_MONTHLY",
        referenceCode: "RC-ABC",
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        consumedAt: null,
        createdAt: new Date("2026-07-25T00:00:00.000Z"),
      }),
    ).toMatchObject({
      id: "pmt1",
      reference_code: "RC-ABC",
      consumed_at: null,
    });
  });
});
