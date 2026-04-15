CREATE TABLE IF NOT EXISTS public.marketing_dropoff_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    surface text NOT NULL CHECK (surface IN ('landing', 'pricing', 'signup', 'checkout', 'paywall', 'plan')),
    reason text NOT NULL CHECK (char_length(reason) > 0 AND char_length(reason) <= 120),
    detail text,
    email text,
    path text,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_marketing_dropoff_events_surface_created
    ON public.marketing_dropoff_events(surface, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_dropoff_events_user
    ON public.marketing_dropoff_events(user_id, created_at DESC);

ALTER TABLE public.marketing_dropoff_events ENABLE ROW LEVEL SECURITY;
