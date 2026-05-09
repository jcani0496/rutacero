-- 043_account_deletion_requests.sql
-- Self-service account deletion with a 7-day grace period.
-- A daily cron picks up matured rows (executes_at <= now()) and runs the
-- cascade by calling auth.admin.deleteUser for each row.

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    executes_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookup index for "active request for this user" queries.
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user
    ON public.account_deletion_requests(user_id)
    WHERE canceled_at IS NULL AND executed_at IS NULL;

-- Cron picks rows by executes_at among active requests.
CREATE INDEX IF NOT EXISTS idx_deletion_requests_pending_executes
    ON public.account_deletion_requests(executes_at)
    WHERE canceled_at IS NULL AND executed_at IS NULL;

-- One ACTIVE deletion request per user, but historical rows are preserved.
CREATE UNIQUE INDEX IF NOT EXISTS uq_deletion_requests_active_per_user
    ON public.account_deletion_requests(user_id)
    WHERE canceled_at IS NULL AND executed_at IS NULL;

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own deletion request"
    ON public.account_deletion_requests;
CREATE POLICY "Users can view own deletion request"
    ON public.account_deletion_requests FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages deletion requests"
    ON public.account_deletion_requests;
CREATE POLICY "Service role manages deletion requests"
    ON public.account_deletion_requests FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.account_deletion_requests IS
    '7-day grace period for self-service account deletion. Cron processes rows where executes_at <= now() AND canceled_at IS NULL AND executed_at IS NULL.';
