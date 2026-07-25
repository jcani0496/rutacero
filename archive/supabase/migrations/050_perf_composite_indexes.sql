-- 050_perf_composite_indexes.sql
-- Audit 2026-07 (perf P1): the Movimientos window queries filter
-- income_events by (tenant_id, user_id) plus a date range, and
-- essential_expenses by (tenant_id, user_id) plus a next_date range —
-- neither range column was covered by a composite index, forcing a
-- filter over every row the RLS scope returns.
--
-- debts(user_id, status) covers the admin user-list batch
-- (admin-users.ts), which intentionally queries across tenants by
-- user_id alone and previously fell back to a sequential scan.

CREATE INDEX IF NOT EXISTS idx_income_events_tenant_user_date
    ON public.income_events (tenant_id, user_id, date);

CREATE INDEX IF NOT EXISTS idx_essential_expenses_tenant_user_next_date
    ON public.essential_expenses (tenant_id, user_id, next_date);

CREATE INDEX IF NOT EXISTS idx_debts_user_status
    ON public.debts (user_id, status);
