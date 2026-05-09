-- 042_pending_manual_transfers.sql
-- Persist manual transfer reference codes for 7 days so users can recover them
-- and admin grants can be cross-checked.

CREATE TABLE IF NOT EXISTS public.pending_manual_transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    variant_code VARCHAR(32) NOT NULL,
    reference_code VARCHAR(80) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_manual_transfers_tenant
    ON public.pending_manual_transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pending_manual_transfers_pending_expires
    ON public.pending_manual_transfers(expires_at)
    WHERE consumed_at IS NULL;

ALTER TABLE public.pending_manual_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view tenant pending transfers" ON public.pending_manual_transfers;
CREATE POLICY "Members can view tenant pending transfers"
    ON public.pending_manual_transfers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships m
            WHERE m.tenant_id = pending_manual_transfers.tenant_id
              AND m.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service role manages pending transfers" ON public.pending_manual_transfers;
CREATE POLICY "Service role manages pending transfers"
    ON public.pending_manual_transfers FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.pending_manual_transfers IS 'Manual transfer reference codes pending admin verification. Read: tenant members. Write: service role.';
