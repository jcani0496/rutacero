-- Debt Control SaaS - Initial Database Schema
-- Version: 1.0
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USER PROFILES
-- ============================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency_base VARCHAR(3) NOT NULL DEFAULT 'GTQ' CHECK (currency_base IN ('GTQ', 'USD')),
  pay_frequency VARCHAR(20) NOT NULL DEFAULT 'BIWEEKLY' CHECK (pay_frequency IN ('BIWEEKLY', 'MONTHLY', 'VARIABLE')),
  pay_dates INTEGER[] NOT NULL DEFAULT ARRAY[15, 30],
  goal_type VARCHAR(20) NOT NULL DEFAULT 'BALANCED' CHECK (goal_type IN ('FASTEST', 'LEAST_INTEREST', 'BALANCED')),
  timezone VARCHAR(50) NOT NULL DEFAULT 'America/Guatemala',
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================
-- DEBTS
-- ============================================
CREATE TABLE debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('CREDIT_CARD', 'LOAN', 'INSTALLMENT', 'INFORMAL')),
  creditor VARCHAR(255) NOT NULL,
  balance DECIMAL(15, 2) NOT NULL CHECK (balance >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'GTQ' CHECK (currency IN ('GTQ', 'USD')),
  apr DECIMAL(6, 2) CHECK (apr IS NULL OR (apr >= 0 AND apr <= 300)),
  min_payment DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (min_payment >= 0),
  statement_date INTEGER CHECK (statement_date IS NULL OR (statement_date >= 1 AND statement_date <= 31)),
  due_date INTEGER CHECK (due_date IS NULL OR (due_date >= 1 AND due_date <= 31)),
  next_payment_date DATE NOT NULL,
  installment_count INTEGER CHECK (installment_count IS NULL OR installment_count > 0),
  installments_left INTEGER CHECK (installments_left IS NULL OR installments_left >= 0),
  fixed_payment DECIMAL(15, 2) CHECK (fixed_payment IS NULL OR fixed_payment >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAID_OFF', 'RESTRUCTURED', 'DEFAULTED')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_debts_user_id ON debts(user_id);
CREATE INDEX idx_debts_status ON debts(status);

-- ============================================
-- DEBT DOCUMENTS
-- ============================================
CREATE TABLE debt_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_debt_documents_debt_id ON debt_documents(debt_id);

-- ============================================
-- PAYMENTS
-- ============================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'GTQ' CHECK (currency IN ('GTQ', 'USD')),
  payment_date DATE NOT NULL,
  method VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_debt_id ON payments(debt_id);
CREATE INDEX idx_payments_date ON payments(payment_date);

-- ============================================
-- INCOME EVENTS
-- ============================================
CREATE TABLE income_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'GTQ' CHECK (currency IN ('GTQ', 'USD')),
  type VARCHAR(20) NOT NULL DEFAULT 'FIXED' CHECK (type IN ('FIXED', 'VARIABLE')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_income_events_user_id ON income_events(user_id);
CREATE INDEX idx_income_events_date ON income_events(date);

-- ============================================
-- ESSENTIAL EXPENSES
-- ============================================
CREATE TABLE essential_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  frequency VARCHAR(20) NOT NULL DEFAULT 'MONTHLY' CHECK (frequency IN ('MONTHLY', 'BIWEEKLY')),
  next_date DATE NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'GTQ' CHECK (currency IN ('GTQ', 'USD')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_essential_expenses_user_id ON essential_expenses(user_id);

-- ============================================
-- VARIABLE BUDGET TARGETS
-- ============================================
CREATE TABLE variable_budget_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  period VARCHAR(20) NOT NULL DEFAULT 'MONTHLY' CHECK (period IN ('MONTHLY', 'BIWEEKLY')),
  currency VARCHAR(3) NOT NULL DEFAULT 'GTQ' CHECK (currency IN ('GTQ', 'USD')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_variable_budget_targets_user_id ON variable_budget_targets(user_id);

-- ============================================
-- PLANS
-- ============================================
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy VARCHAR(20) NOT NULL CHECK (strategy IN ('AVALANCHE', 'SNOWBALL', 'HYBRID')),
  engine_version VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT FALSE,
  assumptions JSONB NOT NULL DEFAULT '{}',
  horizon_periods INTEGER NOT NULL DEFAULT 8,
  eta_debt_free DATE NOT NULL,
  interest_estimate DECIMAL(15, 2) NOT NULL DEFAULT 0,
  avg_payment DECIMAL(15, 2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_plans_user_id ON plans(user_id);
CREATE INDEX idx_plans_active ON plans(active);

-- ============================================
-- PLAN ITEMS
-- ============================================
CREATE TABLE plan_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  planned_amount DECIMAL(15, 2) NOT NULL CHECK (planned_amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'GTQ' CHECK (currency IN ('GTQ', 'USD')),
  priority_order INTEGER NOT NULL,
  is_focus BOOLEAN NOT NULL DEFAULT FALSE,
  rationale JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_plan_items_plan_id ON plan_items(plan_id);

-- ============================================
-- FORECASTS
-- ============================================
CREATE TABLE forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  engine_version VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  horizon_periods INTEGER NOT NULL DEFAULT 8,
  periods JSONB NOT NULL DEFAULT '[]',
  mae_last_period DECIMAL(15, 2)
);

CREATE INDEX idx_forecasts_user_id ON forecasts(user_id);

-- ============================================
-- ALERTS
-- ============================================
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN ('PAYMENT_DUE', 'INSUFFICIENT_CASH', 'BUDGET_EXCEEDED', 'PLAN_DEVIATION')),
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  period_start DATE NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_status ON alerts(status);

-- ============================================
-- SUBSCRIPTIONS
-- ============================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code VARCHAR(20) NOT NULL DEFAULT 'FREE' CHECK (plan_code IN ('FREE', 'PRO', 'BUSINESS')),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED')),
  provider VARCHAR(50) NOT NULL DEFAULT 'recurrente',
  external_id VARCHAR(255),
  start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  renew_at TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ============================================
-- INVOICES
-- ============================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'GTQ' CHECK (currency IN ('GTQ', 'USD')),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  pdf_url TEXT
);

CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);

-- ============================================
-- PAYMENT WEBHOOK EVENTS
-- ============================================
CREATE TABLE payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(50) NOT NULL,
  external_event_id VARCHAR(255) NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  error TEXT,
  UNIQUE(provider, external_event_id)
);

-- ============================================
-- ADMIN USERS
-- ============================================
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(30) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'OPS_ADMIN', 'SUPPORT_AGENT', 'ANALYST', 'CONTENT_MANAGER')),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- SUPPORT TICKETS
-- ============================================
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  assigned_to_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED')),
  category VARCHAR(50) NOT NULL CHECK (category IN ('BILLING', 'ACCESS', 'BUG', 'DATA', 'FEATURE_REQUEST', 'OTHER')),
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);

-- ============================================
-- AUDIT LOGS
-- ============================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  ip VARCHAR(45) NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_admin_user_id ON audit_logs(admin_user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================
-- ENGINE CONFIGS
-- ============================================
CREATE TABLE engine_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version VARCHAR(20) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  weights JSONB NOT NULL DEFAULT '{
    "w_rate": 0.35,
    "w_balance": 0.15,
    "w_due": 0.20,
    "w_mora": 0.20,
    "w_util": 0.05,
    "w_behavior": 0.05,
    "w_type": 0.00,
    "w_fx": 0.00
  }',
  constraints JSONB NOT NULL DEFAULT '{
    "min_cash_buffer": 0,
    "max_simulation_periods": 52,
    "urgency_window_days": 7,
    "max_apr_cap": 120
  }',
  created_by_admin_id UUID NOT NULL REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);

-- ============================================
-- FEATURE FLAGS
-- ============================================
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'DISABLED' CHECK (status IN ('ENABLED', 'DISABLED')),
  rules JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all user tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE essential_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE variable_budget_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- User Profiles policies
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Debts policies
CREATE POLICY "Users can view own debts" ON debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own debts" ON debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debts" ON debts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own debts" ON debts FOR DELETE USING (auth.uid() = user_id);

-- Debt Documents policies
CREATE POLICY "Users can view own debt documents" ON debt_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own debt documents" ON debt_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own debt documents" ON debt_documents FOR DELETE USING (auth.uid() = user_id);

-- Payments policies
CREATE POLICY "Users can view own payments" ON payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payments" ON payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own payments" ON payments FOR DELETE USING (auth.uid() = user_id);

-- Income Events policies
CREATE POLICY "Users can view own income" ON income_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own income" ON income_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own income" ON income_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own income" ON income_events FOR DELETE USING (auth.uid() = user_id);

-- Essential Expenses policies
CREATE POLICY "Users can view own expenses" ON essential_expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own expenses" ON essential_expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expenses" ON essential_expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own expenses" ON essential_expenses FOR DELETE USING (auth.uid() = user_id);

-- Variable Budget Targets policies
CREATE POLICY "Users can view own budgets" ON variable_budget_targets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budgets" ON variable_budget_targets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON variable_budget_targets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON variable_budget_targets FOR DELETE USING (auth.uid() = user_id);

-- Plans policies
CREATE POLICY "Users can view own plans" ON plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own plans" ON plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plans" ON plans FOR UPDATE USING (auth.uid() = user_id);

-- Plan Items policies (via plan ownership)
CREATE POLICY "Users can view own plan items" ON plan_items FOR SELECT 
  USING (EXISTS (SELECT 1 FROM plans WHERE plans.id = plan_items.plan_id AND plans.user_id = auth.uid()));
CREATE POLICY "Users can insert own plan items" ON plan_items FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM plans WHERE plans.id = plan_items.plan_id AND plans.user_id = auth.uid()));

-- Forecasts policies
CREATE POLICY "Users can view own forecasts" ON forecasts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own forecasts" ON forecasts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Alerts policies
CREATE POLICY "Users can view own alerts" ON alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON alerts FOR UPDATE USING (auth.uid() = user_id);

-- Subscriptions policies
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Invoices policies
CREATE POLICY "Users can view own invoices" ON invoices FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_debts_updated_at BEFORE UPDATE ON debts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default engine config (v1.0)
-- Note: You'll need to create an admin user first, then update the created_by_admin_id
-- INSERT INTO engine_configs (version, status, created_by_admin_id, activated_at)
-- VALUES ('1.0', 'ACTIVE', 'admin-user-uuid-here', NOW());

-- Insert default feature flags
INSERT INTO feature_flags (key, status, rules) VALUES
  ('hybrid_engine', 'ENABLED', '{}'),
  ('export_pdf', 'ENABLED', '{"plans": ["PRO", "BUSINESS"]}'),
  ('export_csv', 'ENABLED', '{"plans": ["PRO", "BUSINESS"]}'),
  ('forecast_extended', 'DISABLED', '{"plans": ["BUSINESS"]}');
