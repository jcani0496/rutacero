CREATE TABLE IF NOT EXISTS public.recurrente_checkout_contexts (
    checkout_id text PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    purchaser_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_code varchar(20) NOT NULL DEFAULT 'PRO' CHECK (plan_code IN ('FREE', 'PRO', 'BUSINESS')),
    attribution_id text,
    marketing_context jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_recurrente_checkout_contexts_tenant
    ON public.recurrente_checkout_contexts(tenant_id);

ALTER TABLE public.recurrente_checkout_contexts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can write recurrente checkout contexts"
    ON public.recurrente_checkout_contexts;

CREATE POLICY "Service role can write recurrente checkout contexts"
    ON public.recurrente_checkout_contexts FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
