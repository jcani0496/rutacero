-- 044_subscriptions_purchaser_user_fk.sql
-- Migration 024 added subscriptions.purchaser_user_id without a FK constraint.
-- Add FK with ON DELETE SET NULL so account deletions don't orphan billing rows
-- but historical subscription records are preserved for audit/billing.

-- Defensive: clear orphan values that no longer point to a valid auth.users row.
UPDATE public.subscriptions s
SET purchaser_user_id = NULL
WHERE purchaser_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.purchaser_user_id);

ALTER TABLE public.subscriptions
    DROP CONSTRAINT IF EXISTS fk_subscriptions_purchaser_user;
ALTER TABLE public.subscriptions
    ADD CONSTRAINT fk_subscriptions_purchaser_user
    FOREIGN KEY (purchaser_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
