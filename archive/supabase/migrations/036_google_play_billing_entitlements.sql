CREATE TABLE IF NOT EXISTS public.billing_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('android', 'web')),
    product_id VARCHAR(100) NOT NULL,
    purchase_token VARCHAR(255) NOT NULL,
    order_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED')),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    last_verified_at TIMESTAMPTZ,
    raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, purchase_token)
);

CREATE INDEX IF NOT EXISTS idx_billing_entitlements_tenant_status
    ON public.billing_entitlements(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_billing_entitlements_user_provider
    ON public.billing_entitlements(user_id, provider);
