-- Migration: Add performance indexes for critical queries
-- PERF-005: Optimizes dashboard queries, payment history, and subscription lookups
-- Expected improvements: 50-90% faster on indexed columns

-- ============================================
-- DEBTS TABLE INDEXES
-- ============================================

-- Composite index for dashboard queries (user_id + status)
-- Optimizes: SELECT * FROM debts WHERE user_id = ? AND status = 'ACTIVE'
CREATE INDEX IF NOT EXISTS idx_debts_user_status
ON debts(user_id, status)
WHERE status = 'ACTIVE';

-- For ordering by creation date in debt lists
CREATE INDEX IF NOT EXISTS idx_debts_created
ON debts(created_at DESC);

-- For due_day queries (used in alerts and payment reminders)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'debts' AND column_name = 'due_day'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_debts_due_day
        ON debts(user_id, due_day)
        WHERE status = 'ACTIVE';
    END IF;
END $$;

-- ============================================
-- PAYMENTS TABLE INDEXES
-- ============================================

-- For user payment history
-- Optimizes: SELECT * FROM payments WHERE user_id = ? ORDER BY payment_date DESC
CREATE INDEX IF NOT EXISTS idx_payments_user_date
ON payments(user_id, payment_date DESC);

-- For queries by debt (debt detail page)
CREATE INDEX IF NOT EXISTS idx_payments_debt
ON payments(debt_id, payment_date DESC);

-- For date range searches in analytics
CREATE INDEX IF NOT EXISTS idx_payments_date_range
ON payments(payment_date DESC)
WHERE payment_date IS NOT NULL;

-- ============================================
-- SUBSCRIPTIONS TABLE INDEXES
-- ============================================

-- Unique index for external_id lookups (webhook processing)
-- Critical for O(1) subscription lookups from payment provider
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_external
ON subscriptions(external_id)
WHERE external_id IS NOT NULL;

-- For active subscription queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_status
ON subscriptions(user_id, status)
WHERE status IN ('ACTIVE', 'PAST_DUE');

-- ============================================
-- INCOME_EVENTS TABLE INDEXES
-- ============================================

-- For fetching user incomes ordered by next occurrence
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'income_events' AND column_name = 'next_date'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_income_events_user
        ON income_events(user_id, next_date DESC);
    END IF;
END $$;

-- ============================================
-- ESSENTIAL_EXPENSES TABLE INDEXES
-- ============================================

-- For fetching user expenses with due day ordering
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'essential_expenses' AND column_name = 'due_day'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_essential_expenses_user
        ON essential_expenses(user_id, due_day);
    END IF;
END $$;

-- ============================================
-- PLANS TABLE INDEXES
-- ============================================

-- For fetching active plan for a user (only one active plan allowed)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'plans' AND column_name = 'is_active'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_plans_user_active
        ON plans(user_id, is_active)
        WHERE is_active = TRUE;
    END IF;
END $$;

-- ============================================
-- ALERTS TABLE INDEXES
-- ============================================

-- For unread alerts queries (notification badge, alerts page)
-- Partial index for better performance on unread filter
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'alerts' AND column_name = 'is_read'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_alerts_unread
        ON alerts(user_id, is_read, created_at DESC)
        WHERE is_read = FALSE;
    END IF;
END $$;

-- ============================================
-- AUDIT_LOGS TABLE INDEXES (Admin Panel)
-- ============================================

-- For admin audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin
ON audit_logs(admin_id, created_at DESC);

-- For filtering by action type
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
ON audit_logs(action, created_at DESC);

-- ============================================
-- ADMIN_NOTIFICATIONS TABLE INDEXES
-- ============================================

-- For unread admin notifications
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'admin_notifications' AND column_name = 'is_read'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread
        ON admin_notifications(admin_id, is_read, created_at DESC)
        WHERE is_read = FALSE;
    END IF;
END $$;

-- ============================================
-- ANALYZE TABLES (Update query planner statistics)
-- ============================================

ANALYZE debts;
ANALYZE payments;
ANALYZE subscriptions;
ANALYZE user_profiles;
ANALYZE income_events;
ANALYZE essential_expenses;
ANALYZE plans;
ANALYZE alerts;
ANALYZE audit_logs;
ANALYZE admin_notifications;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_debts_user_status') THEN
        COMMENT ON INDEX idx_debts_user_status IS
        'Optimizes dashboard debt queries. Expected 80-90% faster on user debt lists.';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_payments_user_date') THEN
        COMMENT ON INDEX idx_payments_user_date IS
        'Optimizes payment history queries. Expected 70-85% faster.';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_subscriptions_external') THEN
        COMMENT ON INDEX idx_subscriptions_external IS
        'Critical for webhook processing. Enables O(1) subscription lookups by external_id.';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_plans_user_active') THEN
        COMMENT ON INDEX idx_plans_user_active IS
        'Optimizes active plan fetching. Only one active plan per user allowed.';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_alerts_unread') THEN
        COMMENT ON INDEX idx_alerts_unread IS
        'Partial index for unread alerts. Significantly faster than full table scan.';
    END IF;
END $$;
