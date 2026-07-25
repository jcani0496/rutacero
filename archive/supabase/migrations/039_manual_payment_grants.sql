-- 039_manual_payment_grants.sql
-- Audit trail for manually granted PRO subscriptions (bank transfer, admin grant).

CREATE TABLE IF NOT EXISTS public.manual_payment_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    granted_by_admin_id uuid NOT NULL REFERENCES public.admin_users(id),
    variant_code VARCHAR(32) NOT NULL,
    price_amount_q NUMERIC(10, 2) NOT NULL,
    bank_reference VARCHAR(120),
    duration_days INTEGER NOT NULL CHECK (duration_days > 0 AND duration_days <= 400),
    expires_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_payment_grants_tenant ON public.manual_payment_grants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_manual_payment_grants_expires ON public.manual_payment_grants(expires_at);

ALTER TABLE public.manual_payment_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only_manual_grants" ON public.manual_payment_grants;
CREATE POLICY "service_role_only_manual_grants"
    ON public.manual_payment_grants
    FOR ALL
    USING (false)
    WITH CHECK (false);

COMMENT ON TABLE public.manual_payment_grants IS 'Auditoría de activaciones manuales (transferencia bancaria, deposito, admin grant).';
