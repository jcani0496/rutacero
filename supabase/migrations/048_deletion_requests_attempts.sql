-- 048_deletion_requests_attempts.sql
-- Audit 2026-07 (P0): a failed deletion left executed_at set, so the row
-- looked "executed" forever while the account and its PII persisted. The
-- cron now rolls executed_at back to NULL on failure and increments
-- attempts; rows are retried on later runs up to a cap enforced in the
-- cron (attempts < 5), keeping permanently-failing rows visible for
-- manual follow-up instead of silently vanishing.

ALTER TABLE public.account_deletion_requests
    ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.account_deletion_requests.attempts IS
    'Failed execution attempts. The daily cron retries rows with attempts below its cap; rows at the cap require manual intervention.';
