-- 037_subscription_billing_variant.sql
-- Permite múltiples variantes PRO (mensual/trimestral/anual) y registrar
-- el método de pago efectivo (recurrente, google_play, manual_transfer).

ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(16) NOT NULL DEFAULT 'monthly'
        CHECK (billing_interval IN ('monthly', 'quarterly', 'yearly', 'pass_30d', 'pass_90d')),
    ADD COLUMN IF NOT EXISTS price_amount_q NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32) NOT NULL DEFAULT 'recurrente'
        CHECK (payment_method IN ('recurrente', 'google_play', 'manual_transfer', 'admin_grant', 'free'));

CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_interval ON public.subscriptions(billing_interval);
CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_method ON public.subscriptions(payment_method);

COMMENT ON COLUMN public.subscriptions.billing_interval IS 'Variante de cobro PRO. pass_30d/pass_90d para Google Play.';
COMMENT ON COLUMN public.subscriptions.price_amount_q IS 'Monto cobrado en GTQ por este período. NULL para FREE.';
COMMENT ON COLUMN public.subscriptions.payment_method IS 'Canal por el que se cobró/activó la suscripción.';
