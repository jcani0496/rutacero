-- 038_subscription_payment_method_backfill.sql
-- Backfill payment_method for FREE rows (migration 037's DEFAULT 'recurrente'
-- was wrong for free-plan rows) and drop low-cardinality indexes that the
-- planner won't use.

-- 1. Correct backfill: FREE rows have no payment processor.
UPDATE public.subscriptions
SET payment_method = 'free'
WHERE plan_code = 'FREE'
  AND payment_method = 'recurrente';

-- 2. Drop low-cardinality indexes (5 distinct values each, table size bounded
--    by tenant count). Reintroduce as partial indexes only if a query needs them.
DROP INDEX IF EXISTS public.idx_subscriptions_billing_interval;
DROP INDEX IF EXISTS public.idx_subscriptions_payment_method;
