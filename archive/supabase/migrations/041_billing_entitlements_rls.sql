-- 041_billing_entitlements_rls.sql
-- Close P0 security gap: enable RLS on billing_entitlements.
-- Without this, any authenticated user (or anon with anon key) can read/write
-- entitlements across tenants via PostgREST.

ALTER TABLE public.billing_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view tenant entitlements" ON public.billing_entitlements;
CREATE POLICY "Members can view tenant entitlements"
    ON public.billing_entitlements FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships m
            WHERE m.tenant_id = billing_entitlements.tenant_id
              AND m.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service role manages entitlements" ON public.billing_entitlements;
CREATE POLICY "Service role manages entitlements"
    ON public.billing_entitlements FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.billing_entitlements IS 'Google Play entitlements per tenant. Read: tenant members only. Write: service role only.';
