-- ============================================
-- RESET DATABASE - RutaCero
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Limpiar todas las tablas de datos (preservar estructura)
TRUNCATE TABLE public.ticket_messages CASCADE;
TRUNCATE TABLE public.support_tickets CASCADE;
TRUNCATE TABLE public.invoices CASCADE;
TRUNCATE TABLE public.payments CASCADE;
TRUNCATE TABLE public.plan_items CASCADE;
TRUNCATE TABLE public.plans CASCADE;
TRUNCATE TABLE public.debts CASCADE;
TRUNCATE TABLE public.essential_expenses CASCADE;
TRUNCATE TABLE public.income_events CASCADE;
TRUNCATE TABLE public.variable_budget_targets CASCADE;
TRUNCATE TABLE public.forecasts CASCADE;
TRUNCATE TABLE public.subscriptions CASCADE;
TRUNCATE TABLE public.billing_entitlements CASCADE;
TRUNCATE TABLE public.user_profiles CASCADE;
TRUNCATE TABLE public.payment_webhook_events CASCADE;

-- 2. Limpiar admin_users (se recreará el super admin)
TRUNCATE TABLE public.admin_users CASCADE;

-- 3. Opcional: Limpiar feature_flags y engine_configs si deseas resetear todo
-- TRUNCATE TABLE public.feature_flags CASCADE;
-- TRUNCATE TABLE public.engine_configs CASCADE;

-- ============================================
-- NOTA: Los usuarios de auth.users deben ser 
-- eliminados desde el Dashboard de Supabase
-- Authentication > Users > Delete All
-- ============================================
