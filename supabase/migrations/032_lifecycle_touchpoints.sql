-- Persist lifecycle touchpoints so activation and retention reviews can measure
-- what was triggered, delivered, skipped, or recovered.

CREATE TABLE IF NOT EXISTS public.lifecycle_touchpoints (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_key text NOT NULL CHECK (
        campaign_key IN (
            'ONBOARDING_NUDGE',
            'FIRST_PLAN_REMINDER',
            'WEEKLY_PROGRESS',
            'OVERDUE_NUDGE',
            'FAILED_PAYMENT_RECOVERY'
        )
    ),
    channel text NOT NULL CHECK (channel IN ('EMAIL', 'IN_APP')),
    status text NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'SENT', 'SKIPPED', 'FAILED', 'RECOVERED')
    ),
    dedupe_key text NOT NULL CHECK (char_length(dedupe_key) > 0 AND char_length(dedupe_key) <= 200),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    triggered_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    delivered_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lifecycle_touchpoints_unique_channel
    ON public.lifecycle_touchpoints(tenant_id, user_id, channel, dedupe_key);

CREATE INDEX IF NOT EXISTS idx_lifecycle_touchpoints_campaign_created
    ON public.lifecycle_touchpoints(campaign_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lifecycle_touchpoints_tenant_user_created
    ON public.lifecycle_touchpoints(tenant_id, user_id, created_at DESC);

ALTER TABLE public.lifecycle_touchpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role manages lifecycle touchpoints" ON public.lifecycle_touchpoints;
CREATE POLICY "service role manages lifecycle touchpoints"
    ON public.lifecycle_touchpoints
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = 'update_lifecycle_touchpoints_updated_at'
        ) THEN
            CREATE TRIGGER update_lifecycle_touchpoints_updated_at
                BEFORE UPDATE ON public.lifecycle_touchpoints
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        END IF;
    ELSIF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = 'update_lifecycle_touchpoints_updated_at'
        ) THEN
            CREATE TRIGGER update_lifecycle_touchpoints_updated_at
                BEFORE UPDATE ON public.lifecycle_touchpoints
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at();
        END IF;
    END IF;
END $$;
