// Enums
export type Currency = 'GTQ' | 'USD';
export type PayFrequency = 'BIWEEKLY' | 'MONTHLY' | 'VARIABLE';
export type GoalType = 'FASTEST' | 'LEAST_INTEREST' | 'BALANCED';
export type DebtType = 'CREDIT_CARD' | 'LOAN' | 'INSTALLMENT' | 'INFORMAL';
export type DebtStatus = 'ACTIVE' | 'PAID_OFF' | 'RESTRUCTURED' | 'DEFAULTED';
export type DebtInterestModel = 'MONTHLY_SIMPLE' | 'DAILY_SIMPLE' | 'DAILY_AVG_BALANCE';
export type PlanStrategy = 'AVALANCHE' | 'SNOWBALL' | 'HYBRID';
export type AlertType = 'PAYMENT_DUE' | 'INSUFFICIENT_CASH' | 'BUDGET_EXCEEDED' | 'PLAN_DEVIATION' | 'GOAL_DEVIATION';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
export type AdminRole = 'SUPER_ADMIN' | 'OPS_ADMIN' | 'SUPPORT_AGENT' | 'ANALYST' | 'CONTENT_MANAGER';

// Debt minimum payment rules (optional, used to estimate variable minimums for some products like credit cards)
export type DebtMinPaymentRule =
    | { type: 'FIXED'; amount: number }
    | { type: 'PERCENT_OF_BALANCE'; percent: number; minimum?: number }
    | { type: 'PERCENT_PLUS_INTEREST_FEES'; percent: number; minimum?: number };

// User Profile
export interface UserProfile {
    id: string;
    user_id: string;
    currency_base: Currency;
    pay_frequency: PayFrequency;
    pay_dates: number[]; // e.g., [15, 30] for biweekly
    goal_type: GoalType;
    timezone: string;
    motivation_level?: number; // 1-5
    risk_tolerance?: number; // 1-5
    safety_buffer_pct?: number; // 0-50
    created_at: string;
    updated_at: string;
}

// Debt
export interface Debt {
    id: string;
    user_id: string;
    type: DebtType;
    creditor: string;
    balance: number;
    currency: Currency;
    apr: number | null; // Annual Percentage Rate
    min_payment: number;
    statement_date: number | null; // Day of month (1-31)
    due_date: number | null; // Day of month (1-31)
    // Modeling fields (optional for backward compatibility)
    interest_model?: DebtInterestModel | null;
    payment_day?: number | null; // When the user typically pays this debt (1-31). Defaults to due_date.
    monthly_fees?: number | null; // Estimated recurring monthly fees for this debt.
    min_payment_rule?: DebtMinPaymentRule | null; // Optional rule to estimate minimum payment dynamically.
    next_payment_date: string; // ISO date
    category?: string | null;
    installment_count: number | null;
    installments_left: number | null;
    fixed_payment: number | null;
    goal_extra_payment?: number | null;
    goal_target_date?: string | null;
    status: DebtStatus;
    notes: string | null;
    tags?: string[]; // Custom tags (PRO feature)
    created_at: string;
    updated_at: string;
}

// Payment
export interface Payment {
    id: string;
    user_id: string;
    debt_id: string;
    amount: number;
    currency: Currency;
    payment_date: string;
    method: string | null;
    created_at: string;
}

// Income Event
export interface IncomeEvent {
    id: string;
    user_id: string;
    date: string;
    amount: number;
    currency: Currency;
    type: 'FIXED' | 'VARIABLE';
    notes: string | null;
    created_at: string;
}

// Essential Expense
export interface EssentialExpense {
    id: string;
    user_id: string;
    name: string;
    amount: number;
    frequency: 'MONTHLY' | 'BIWEEKLY';
    next_date: string;
    currency: Currency;
    created_at: string;
}

// Variable Budget Target
export interface VariableBudgetTarget {
    id: string;
    user_id: string;
    category: string;
    amount: number;
    actual_amount: number;
    period: 'MONTHLY' | 'BIWEEKLY';
    currency: Currency;
    created_at: string;
}

// Plan
export interface Plan {
    id: string;
    user_id: string;
    strategy: PlanStrategy;
    engine_version: string;
    created_at: string;
    active: boolean;
    assumptions: PlanAssumptions | Record<string, unknown>;
    horizon_periods: number;
    eta_debt_free: string;
    interest_estimate: number;
    avg_payment: number;
}

export interface PlanAssumptions {
    extra_payment_cap: number;
    lock_essentials: boolean;
    currency: Currency;
}

// Plan Item
export interface PlanItem {
    id: string;
    plan_id: string;
    period_start: string;
    period_end: string;
    debt_id: string;
    planned_amount: number;
    currency: Currency;
    priority_order: number;
    is_focus: boolean;
    rationale: RationaleBreakdown | Record<string, unknown>;
    // Optional relation from join
    debt?: {
        id: string;
        creditor: string;
        balance: number;
        min_payment: number;
        apr: number | null;
        type: DebtType;
    };
}

export interface RationaleBreakdown {
    score: number;
    contributions: {
        rate: number;
        balance: number;
        due_urgency: number;
        mora_risk: number;
        utilization: number;
        behavior: number;
    };
    reason_text: string;
}

// Forecast
export interface Forecast {
    id: string;
    user_id: string;
    engine_version: string;
    created_at: string;
    horizon_periods: number;
    periods: ForecastPeriod[];
    mae_last_period: number | null;
}

export interface ForecastPeriod {
    period_start: string;
    period_end: string;
    cash_initial: number;
    income: number;
    essentials: number;
    payments: number;
    cash_final: number;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
}

// Alert
export interface Alert {
    id: string;
    user_id: string;
    type: AlertType;
    severity: AlertSeverity;
    period_start: string;
    message: string;
    status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
    created_at: string;
    sent_at: string | null;
}

// Subscription
export interface Subscription {
    id: string;
    user_id: string;
    plan_code: 'FREE' | 'PRO' | 'BUSINESS';
    status: SubscriptionStatus;
    provider: string;
    external_id: string | null;
    start_at: string;
    renew_at: string | null;
    cancel_at: string | null;
}

// Admin User
export interface AdminUser {
    id: string;
    email: string;
    role: AdminRole;
    status: 'ACTIVE' | 'INACTIVE';
    created_at: string;
}

// Audit Log
export interface AuditLog {
    id: string;
    admin_user_id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    metadata: Record<string, unknown>;
    ip: string;
    user_agent: string;
    created_at: string;
}

// Engine Config
export interface EngineConfig {
    id: string;
    version: string;
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    weights: EngineWeights;
    constraints: EngineConstraints;
    created_by_admin_id: string;
    created_at: string;
    activated_at: string | null;
}

export interface EngineWeights {
    w_rate: number;
    w_balance: number;
    w_due: number;
    w_mora: number;
    w_util: number;
    w_behavior: number;
    w_type: number;
    w_fx: number;
}

export interface EngineConstraints {
    min_cash_buffer: number;
    max_simulation_periods: number;
    urgency_window_days: number;
    max_apr_cap: number;
}

// API Response types
export interface ApiResponse<T> {
    data?: T;
    error?: ApiError;
}

export interface ApiError {
    code: string;
    message: string;
    fields?: { field: string; issue: string }[];
}
