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
  UserProfile,
  PayFrequency,
  GoalType,
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

/** Drizzle user_profiles row shape (camelCase). */
export type UserProfileRow = {
  id: string;
  userId: string;
  currencyBase: string;
  payFrequency: string;
  payDates: number[];
  goalType: string;
  timezone: string;
  onboardingCompleted: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastActiveAt?: Date | string | null;
  currentTenantId?: string | null;
  motivationLevel?: number | null;
  riskTolerance?: number | null;
  safetyBufferPct?: string | number | null;
  onboardingMotivation?: string | null;
};

/** Full profile UI contract including onboarding/tenant bootstrap fields. */
export type UserProfileMapped = UserProfile & {
  onboarding_completed: boolean;
  current_tenant_id: string | null;
  onboarding_motivation: string | null;
  last_active_at: string | null;
};

/**
 * Maps a Drizzle camelCase user_profiles row to the snake_case UI contract.
 */
export function mapUserProfileRow(row: UserProfileRow): UserProfileMapped {
  return {
    id: row.id,
    user_id: row.userId,
    currency_base: row.currencyBase as Currency,
    pay_frequency: row.payFrequency as PayFrequency,
    pay_dates: Array.isArray(row.payDates) ? row.payDates : [],
    goal_type: row.goalType as GoalType,
    timezone: row.timezone,
    motivation_level: row.motivationLevel ?? undefined,
    risk_tolerance: row.riskTolerance ?? undefined,
    safety_buffer_pct:
      row.safetyBufferPct == null ? undefined : toNumber(row.safetyBufferPct),
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
    onboarding_completed: Boolean(row.onboardingCompleted),
    current_tenant_id: row.currentTenantId ?? null,
    onboarding_motivation: row.onboardingMotivation ?? null,
    last_active_at: row.lastActiveAt ? toIso(row.lastActiveAt) : null,
  };
}

/** Drizzle user_notifications row shape (camelCase). */
export type UserNotificationRow = {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string | null;
  read: boolean;
  createdAt: Date | string;
  metadata: unknown;
};

/** Snake_case user notification UI / action contract. */
export type UserNotificationMapped = {
  id: string;
  type:
    | "PAYMENT_REMINDER"
    | "PAYMENT_DUE"
    | "OVERDUE"
    | "MILESTONE"
    | "PLAN_NUDGE"
    | "SYSTEM";
  severity: "INFO" | "WARNING" | "CRITICAL" | "SUCCESS";
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
};

/**
 * Maps a Drizzle camelCase user_notifications row to the snake_case UI contract.
 */
export function mapUserNotificationRow(
  row: UserNotificationRow,
): UserNotificationMapped {
  const metadata =
    row.metadata &&
    typeof row.metadata === "object" &&
    !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    id: row.id,
    type: row.type as UserNotificationMapped["type"],
    severity: row.severity as UserNotificationMapped["severity"],
    title: row.title,
    message: row.message,
    read: Boolean(row.read),
    created_at: toIso(row.createdAt),
    metadata,
  };
}

/** Drizzle lifecycle_touchpoints row shape (camelCase). */
export type LifecycleTouchpointRow = {
  id: string;
  tenantId: string;
  userId: string;
  campaignKey: string;
  channel: string;
  status: string;
  dedupeKey: string;
  metadata: unknown;
  triggeredAt: Date | string;
  deliveredAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

/** Snake_case lifecycle touchpoint contract. */
export type LifecycleTouchpointMapped = {
  id: string;
  tenant_id: string;
  user_id: string;
  campaign_key: string;
  channel: string;
  status: string;
  dedupe_key: string;
  metadata: Record<string, unknown>;
  triggered_at: string;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Maps a Drizzle camelCase lifecycle_touchpoints row to snake_case.
 */
export function mapLifecycleTouchpointRow(
  row: LifecycleTouchpointRow,
): LifecycleTouchpointMapped {
  const metadata =
    row.metadata &&
    typeof row.metadata === "object" &&
    !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    id: row.id,
    tenant_id: row.tenantId,
    user_id: row.userId,
    campaign_key: row.campaignKey,
    channel: row.channel,
    status: row.status,
    dedupe_key: row.dedupeKey,
    metadata,
    triggered_at: toIso(row.triggeredAt),
    delivered_at: row.deliveredAt ? toIso(row.deliveredAt) : null,
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
  };
}

/** Drizzle legacy alerts row shape (camelCase). */
export type AlertRow = {
  id: string;
  userId: string;
  type: string;
  severity: string;
  periodStart: string;
  message: string;
  status: string;
  createdAt: Date | string;
  sentAt: Date | string | null;
  tenantId: string;
};

/** Snake_case legacy alerts table contract. */
export type AlertMapped = {
  id: string;
  user_id: string;
  type: string;
  severity: string;
  period_start: string;
  message: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  tenant_id: string;
};

/**
 * Maps a Drizzle camelCase alerts row to the snake_case table contract.
 */
export function mapAlertRow(row: AlertRow): AlertMapped {
  return {
    id: row.id,
    user_id: row.userId,
    type: row.type,
    severity: row.severity,
    period_start: row.periodStart,
    message: row.message,
    status: row.status,
    created_at: toIso(row.createdAt),
    sent_at: row.sentAt ? toIso(row.sentAt) : null,
    tenant_id: row.tenantId,
  };
}

/** Drizzle support_tickets row shape (camelCase). */
export type SupportTicketRow = {
  id: string;
  userId: string | null;
  subject: string;
  description: string | null;
  body?: string | null;
  status: string;
  priority: string;
  category: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  resolvedAt: Date | string | null;
  assignedAdminId: string | null;
  tenantId?: string | null;
};

/** Snake_case support ticket UI / action contract. */
export type SupportTicketMapped = {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  assigned_admin_id: string | null;
  tenant_id?: string | null;
};

/**
 * Maps a Drizzle camelCase support_tickets row to snake_case.
 */
export function mapSupportTicketRow(row: SupportTicketRow): SupportTicketMapped {
  return {
    id: row.id,
    user_id: row.userId ?? "",
    subject: row.subject,
    description: row.description ?? row.body ?? "",
    status: row.status,
    priority: row.priority,
    category: row.category,
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
    resolved_at: row.resolvedAt ? toIso(row.resolvedAt) : null,
    assigned_admin_id: row.assignedAdminId,
    tenant_id: row.tenantId ?? null,
  };
}

/** Drizzle ticket_messages row shape (camelCase). */
export type TicketMessageRow = {
  id: string;
  ticketId: string;
  senderType: string;
  senderId: string;
  message: string;
  isInternal: boolean;
  createdAt: Date | string;
  tenantId?: string | null;
};

/** Snake_case ticket message UI / action contract. */
export type TicketMessageMapped = {
  id: string;
  ticket_id: string;
  sender_type: string;
  sender_id: string;
  message: string;
  is_internal: boolean;
  created_at: string;
};

/**
 * Maps a Drizzle camelCase ticket_messages row to snake_case.
 */
export function mapTicketMessageRow(row: TicketMessageRow): TicketMessageMapped {
  return {
    id: row.id,
    ticket_id: row.ticketId,
    sender_type: row.senderType,
    sender_id: row.senderId,
    message: row.message,
    is_internal: Boolean(row.isInternal),
    created_at: toIso(row.createdAt),
  };
}

/** Drizzle admin_support_settings row shape (camelCase). */
export type AdminSupportSettingsRow = {
  id: string;
  autoAssignEnabled: boolean;
  autoAssignStrategy: string;
  autoAssignPriorities: string[] | null;
  lastRoundRobinIndex: number;
  slaEscalationEnabled: boolean;
  staleReassignEnabled: boolean;
  staleReassignHours: number;
  updatedAt: Date | string;
};

/** Snake_case admin support settings contract. */
export type AdminSupportSettingsMapped = {
  id: string;
  auto_assign_enabled: boolean;
  auto_assign_strategy: string;
  auto_assign_priorities: string[];
  last_round_robin_index: number;
  sla_escalation_enabled: boolean;
  stale_reassign_enabled: boolean;
  stale_reassign_hours: number;
  updated_at: string;
};

/**
 * Maps a Drizzle camelCase admin_support_settings row to snake_case.
 */
export function mapAdminSupportSettingsRow(
  row: AdminSupportSettingsRow,
): AdminSupportSettingsMapped {
  return {
    id: row.id,
    auto_assign_enabled: Boolean(row.autoAssignEnabled),
    auto_assign_strategy: row.autoAssignStrategy,
    auto_assign_priorities: Array.isArray(row.autoAssignPriorities)
      ? row.autoAssignPriorities
      : [],
    last_round_robin_index: row.lastRoundRobinIndex ?? 0,
    sla_escalation_enabled: Boolean(row.slaEscalationEnabled),
    stale_reassign_enabled: Boolean(row.staleReassignEnabled),
    stale_reassign_hours: row.staleReassignHours ?? 24,
    updated_at: toIso(row.updatedAt),
  };
}

/** Drizzle admin_support_rules row shape (camelCase). */
export type AdminSupportRuleRow = {
  id: string;
  name: string;
  isActive: boolean;
  category: string;
  planCode: string | null;
  setPriority: string | null;
  assignRole: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

/** Snake_case support automation rule contract. */
export type AdminSupportRuleMapped = {
  id: string;
  name: string;
  is_active: boolean;
  category: string;
  plan_code: string | null;
  set_priority: string | null;
  assign_role: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Maps a Drizzle camelCase admin_support_rules row to snake_case.
 */
export function mapAdminSupportRuleRow(
  row: AdminSupportRuleRow,
): AdminSupportRuleMapped {
  return {
    id: row.id,
    name: row.name,
    is_active: Boolean(row.isActive),
    category: row.category,
    plan_code: row.planCode,
    set_priority: row.setPriority,
    assign_role: row.assignRole,
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
  };
}

/** Drizzle admin_reply_templates row shape (camelCase). */
export type AdminReplyTemplateRow = {
  id: string;
  title: string;
  body: string;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  createdBy: string | null;
};

/** Snake_case reply template contract. */
export type AdminReplyTemplateMapped = {
  id: string;
  title: string;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

/**
 * Maps a Drizzle camelCase admin_reply_templates row to snake_case.
 */
export function mapAdminReplyTemplateRow(
  row: AdminReplyTemplateRow,
): AdminReplyTemplateMapped {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    is_active: Boolean(row.isActive),
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
    created_by: row.createdBy,
  };
}

/** Drizzle support_ticket_labels row shape (camelCase). */
export type SupportTicketLabelRow = {
  id: string;
  ticketId: string;
  label: string;
  createdAt: Date | string;
  createdBy: string | null;
};

/** Snake_case ticket label contract (name filled by join caller). */
export type SupportTicketLabelMapped = {
  id: string;
  ticket_id: string;
  label: string;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
};

/**
 * Maps a Drizzle camelCase support_ticket_labels row to snake_case.
 */
export function mapSupportTicketLabelRow(
  row: SupportTicketLabelRow,
  createdByName: string | null = null,
): SupportTicketLabelMapped {
  return {
    id: row.id,
    ticket_id: row.ticketId,
    label: row.label,
    created_at: toIso(row.createdAt),
    created_by: row.createdBy,
    created_by_name: createdByName,
  };
}

/** Drizzle admin_saved_views row shape (camelCase). */
export type AdminSavedViewRow = {
  id: string;
  name: string;
  filters: unknown;
  createdAt: Date | string;
};

/** Snake_case admin saved view contract. */
export type AdminSavedViewMapped = {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  created_at: string;
};

/**
 * Maps a Drizzle camelCase admin_saved_views row to snake_case.
 */
export function mapAdminSavedViewRow(
  row: AdminSavedViewRow,
): AdminSavedViewMapped {
  const filters =
    row.filters && typeof row.filters === "object" && !Array.isArray(row.filters)
      ? (row.filters as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    name: row.name,
    filters,
    created_at: toIso(row.createdAt),
  };
}

/** Drizzle admin_users row shape (camelCase) for support assignees. */
export type AdminUserRow = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
};

/** Snake_case admin assignee contract. */
export type AdminUserMapped = {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  is_active: boolean;
};

/**
 * Maps a Drizzle camelCase admin_users row to snake_case assignee shape.
 */
export function mapAdminUserRow(row: AdminUserRow): AdminUserMapped {
  return {
    id: row.id,
    email: row.email,
    display_name: row.displayName,
    role: row.role,
    is_active: Boolean(row.isActive),
  };
}

function toJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return toIso(value);
}

/** Drizzle subscriptions row shape (camelCase). */
export type SubscriptionRow = {
  id?: string;
  userId: string;
  planCode: string;
  status: string;
  provider: string;
  externalId: string | null;
  startAt?: Date | string;
  renewAt: Date | string | null;
  cancelAt?: Date | string | null;
  updatedAt?: Date | string;
  tenantId: string;
  purchaserUserId: string | null;
  attributionId: string | null;
  marketingContext: unknown;
  billingInterval?: string;
  priceAmountQ?: string | number | null;
  paymentMethod?: string;
};

/** Snake_case subscription contract used by billing/funnel call sites. */
export type SubscriptionMapped = {
  id?: string;
  user_id: string;
  plan_code: string;
  status: string;
  provider: string;
  external_id: string | null;
  start_at?: string;
  renew_at: string | null;
  cancel_at?: string | null;
  updated_at?: string;
  tenant_id: string;
  purchaser_user_id: string | null;
  attribution_id: string | null;
  marketing_context: Record<string, unknown>;
  billing_interval?: string;
  price_amount_q?: number | null;
  payment_method?: string;
};

/**
 * Maps a Drizzle camelCase subscriptions row to snake_case.
 */
export function mapSubscriptionRow(row: SubscriptionRow): SubscriptionMapped {
  return {
    ...(row.id ? { id: row.id } : {}),
    user_id: row.userId,
    plan_code: row.planCode,
    status: row.status,
    provider: row.provider,
    external_id: row.externalId,
    ...(row.startAt !== undefined ? { start_at: toIso(row.startAt) } : {}),
    renew_at: toIsoOrNull(row.renewAt),
    ...(row.cancelAt !== undefined
      ? { cancel_at: toIsoOrNull(row.cancelAt) }
      : {}),
    ...(row.updatedAt !== undefined
      ? { updated_at: toIso(row.updatedAt) }
      : {}),
    tenant_id: row.tenantId,
    purchaser_user_id: row.purchaserUserId,
    attribution_id: row.attributionId,
    marketing_context: toJsonObject(row.marketingContext),
    ...(row.billingInterval !== undefined
      ? { billing_interval: row.billingInterval }
      : {}),
    ...(row.priceAmountQ !== undefined
      ? { price_amount_q: toNumberOrNull(row.priceAmountQ) }
      : {}),
    ...(row.paymentMethod !== undefined
      ? { payment_method: row.paymentMethod }
      : {}),
  };
}

/** Drizzle billing_entitlements row shape (camelCase). */
export type BillingEntitlementRow = {
  id: string;
  tenantId: string;
  userId: string;
  provider: string;
  platform: string;
  productId: string;
  purchaseToken: string;
  orderId: string | null;
  status: string;
  grantedAt: Date | string;
  expiresAt: Date | string | null;
  lastVerifiedAt: Date | string | null;
  rawResponse: unknown;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

/** Snake_case billing entitlement contract. */
export type BillingEntitlementMapped = {
  id: string;
  tenant_id: string;
  user_id: string;
  provider: string;
  platform: string;
  product_id: string;
  purchase_token: string;
  order_id: string | null;
  status: string;
  granted_at: string;
  expires_at: string | null;
  last_verified_at: string | null;
  raw_response: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

/**
 * Maps a Drizzle camelCase billing_entitlements row to snake_case.
 */
export function mapBillingEntitlementRow(
  row: BillingEntitlementRow,
): BillingEntitlementMapped {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    user_id: row.userId,
    provider: row.provider,
    platform: row.platform,
    product_id: row.productId,
    purchase_token: row.purchaseToken,
    order_id: row.orderId,
    status: row.status,
    granted_at: toIso(row.grantedAt),
    expires_at: toIsoOrNull(row.expiresAt),
    last_verified_at: toIsoOrNull(row.lastVerifiedAt),
    raw_response: toJsonObject(row.rawResponse),
    ...(row.createdAt !== undefined
      ? { created_at: toIso(row.createdAt) }
      : {}),
    ...(row.updatedAt !== undefined
      ? { updated_at: toIso(row.updatedAt) }
      : {}),
  };
}

/** Drizzle recurrente_checkout_contexts row shape (camelCase). */
export type RecurrenteCheckoutContextRow = {
  checkoutId: string;
  tenantId: string;
  purchaserUserId: string;
  planCode: string;
  attributionId: string | null;
  marketingContext: unknown;
  createdAt?: Date | string;
};

/** Snake_case checkout context contract. */
export type RecurrenteCheckoutContextMapped = {
  checkout_id: string;
  tenant_id: string;
  purchaser_user_id: string;
  plan_code: string;
  attribution_id: string | null;
  marketing_context: Record<string, unknown>;
  created_at?: string;
};

/**
 * Maps a Drizzle camelCase recurrente_checkout_contexts row to snake_case.
 */
export function mapRecurrenteCheckoutContextRow(
  row: RecurrenteCheckoutContextRow,
): RecurrenteCheckoutContextMapped {
  return {
    checkout_id: row.checkoutId,
    tenant_id: row.tenantId,
    purchaser_user_id: row.purchaserUserId,
    plan_code: row.planCode,
    attribution_id: row.attributionId,
    marketing_context: toJsonObject(row.marketingContext),
    ...(row.createdAt !== undefined
      ? { created_at: toIso(row.createdAt) }
      : {}),
  };
}

/** Drizzle payment_webhook_events row shape (camelCase). */
export type PaymentWebhookEventRow = {
  id: string;
  provider: string;
  externalEventId: string;
  receivedAt: Date | string;
  payload: unknown;
  processed: boolean;
  error: string | null;
};

/** Snake_case payment webhook event contract. */
export type PaymentWebhookEventMapped = {
  id: string;
  provider: string;
  external_event_id: string;
  received_at: string;
  payload: unknown;
  processed: boolean;
  error: string | null;
};

/**
 * Maps a Drizzle camelCase payment_webhook_events row to snake_case.
 */
export function mapPaymentWebhookEventRow(
  row: PaymentWebhookEventRow,
): PaymentWebhookEventMapped {
  return {
    id: row.id,
    provider: row.provider,
    external_event_id: row.externalEventId,
    received_at: toIso(row.receivedAt),
    payload: row.payload,
    processed: Boolean(row.processed),
    error: row.error,
  };
}

/** Drizzle manual_payment_grants row shape (camelCase). */
export type ManualPaymentGrantRow = {
  id: string;
  tenantId: string;
  grantedByAdminId: string;
  variantCode: string;
  priceAmountQ: string | number;
  bankReference: string;
  durationDays: number;
  expiresAt: Date | string;
  notes: string | null;
  createdAt: Date | string;
};

/** Snake_case manual payment grant contract. */
export type ManualPaymentGrantMapped = {
  id: string;
  tenant_id: string;
  granted_by_admin_id: string;
  variant_code: string;
  price_amount_q: number;
  bank_reference: string;
  duration_days: number;
  expires_at: string;
  notes: string | null;
  created_at: string;
};

/**
 * Maps a Drizzle camelCase manual_payment_grants row to snake_case.
 */
export function mapManualPaymentGrantRow(
  row: ManualPaymentGrantRow,
): ManualPaymentGrantMapped {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    granted_by_admin_id: row.grantedByAdminId,
    variant_code: row.variantCode,
    price_amount_q: toNumber(row.priceAmountQ),
    bank_reference: row.bankReference,
    duration_days: row.durationDays,
    expires_at: toIso(row.expiresAt),
    notes: row.notes,
    created_at: toIso(row.createdAt),
  };
}

/** Drizzle pending_manual_transfers row shape (camelCase). */
export type PendingManualTransferRow = {
  id: string;
  tenantId: string;
  userId: string;
  variantCode: string;
  referenceCode: string;
  expiresAt: Date | string;
  consumedAt: Date | string | null;
  createdAt: Date | string;
};

/** Snake_case pending manual transfer contract. */
export type PendingManualTransferMapped = {
  id: string;
  tenant_id: string;
  user_id: string;
  variant_code: string;
  reference_code: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

/**
 * Maps a Drizzle camelCase pending_manual_transfers row to snake_case.
 */
export function mapPendingManualTransferRow(
  row: PendingManualTransferRow,
): PendingManualTransferMapped {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    user_id: row.userId,
    variant_code: row.variantCode,
    reference_code: row.referenceCode,
    expires_at: toIso(row.expiresAt),
    consumed_at: toIsoOrNull(row.consumedAt),
    created_at: toIso(row.createdAt),
  };
}

/** Drizzle marketing_funnel_events row shape (camelCase). */
export type MarketingFunnelEventRow = {
  id: string;
  createdAt: Date | string;
  occurredAt: Date | string;
  tenantId: string | null;
  userId: string | null;
  email: string | null;
  eventName: string;
  attributionId: string;
  source: string | null;
  medium: string | null;
  campaignId: string | null;
  campaignName: string | null;
  creativeId: string | null;
  creativeName: string | null;
  partnerSlug: string | null;
  referralCode: string | null;
  landingVariant: string | null;
  offerVariant: string | null;
  ctaContext: string | null;
  path: string | null;
  planStrategy: string | null;
  dedupeKey: string | null;
  firstTouch: unknown;
  lastTouch: unknown;
  metadata: unknown;
};

/** Snake_case marketing funnel event contract. */
export type MarketingFunnelEventMapped = {
  id: string;
  created_at: string;
  occurred_at: string;
  tenant_id: string | null;
  user_id: string | null;
  email: string | null;
  event_name: string;
  attribution_id: string;
  source: string | null;
  medium: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  creative_id: string | null;
  creative_name: string | null;
  partner_slug: string | null;
  referral_code: string | null;
  landing_variant: string | null;
  offer_variant: string | null;
  cta_context: string | null;
  path: string | null;
  plan_strategy: string | null;
  dedupe_key: string | null;
  first_touch: Record<string, unknown>;
  last_touch: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

/**
 * Maps a Drizzle camelCase marketing_funnel_events row to snake_case.
 */
export function mapMarketingFunnelEventRow(
  row: MarketingFunnelEventRow,
): MarketingFunnelEventMapped {
  return {
    id: row.id,
    created_at: toIso(row.createdAt),
    occurred_at: toIso(row.occurredAt),
    tenant_id: row.tenantId,
    user_id: row.userId,
    email: row.email,
    event_name: row.eventName,
    attribution_id: row.attributionId,
    source: row.source,
    medium: row.medium,
    campaign_id: row.campaignId,
    campaign_name: row.campaignName,
    creative_id: row.creativeId,
    creative_name: row.creativeName,
    partner_slug: row.partnerSlug,
    referral_code: row.referralCode,
    landing_variant: row.landingVariant,
    offer_variant: row.offerVariant,
    cta_context: row.ctaContext,
    path: row.path,
    plan_strategy: row.planStrategy,
    dedupe_key: row.dedupeKey,
    first_touch: toJsonObject(row.firstTouch),
    last_touch: toJsonObject(row.lastTouch),
    metadata: toJsonObject(row.metadata),
  };
}
