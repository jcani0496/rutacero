CREATE TABLE IF NOT EXISTS public.marketing_funnel_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    occurred_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    email text,
    event_name text NOT NULL CHECK (
        event_name IN (
            'signup_started',
            'email_verified',
            'onboarding_completed',
            'first_debt_added',
            'first_plan_generated',
            'pricing_viewed',
            'checkout_started',
            'payment_succeeded',
            'payment_failed',
            'failed_payment_recovered',
            'dropoff_reported'
        )
    ),
    attribution_id text NOT NULL CHECK (char_length(attribution_id) > 0 AND char_length(attribution_id) <= 120),
    source text,
    medium text,
    campaign_id text,
    campaign_name text,
    creative_id text,
    creative_name text,
    partner_slug text,
    referral_code text,
    landing_variant text,
    offer_variant text,
    cta_context text,
    path text,
    plan_strategy text,
    dedupe_key text,
    first_touch jsonb NOT NULL DEFAULT '{}'::jsonb,
    last_touch jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_marketing_funnel_events_occurred
    ON public.marketing_funnel_events(event_name, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_funnel_events_attribution
    ON public.marketing_funnel_events(attribution_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_funnel_events_slice_dims
    ON public.marketing_funnel_events(source, medium, partner_slug, landing_variant, offer_variant, cta_context);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_funnel_events_dedupe
    ON public.marketing_funnel_events(dedupe_key)
    WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.marketing_funnel_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role manages marketing funnel events" ON public.marketing_funnel_events;
CREATE POLICY "service role manages marketing funnel events"
    ON public.marketing_funnel_events
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS attribution_id text,
    ADD COLUMN IF NOT EXISTS marketing_context jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_subscriptions_attribution_id
    ON public.subscriptions(attribution_id);
