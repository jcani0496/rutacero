-- Phase G — payment receipt photo upload (T30)
-- Adds receipt metadata columns to payments. The actual file lives in the
-- private `payment-receipts` Storage bucket; see docs/operational/storage-buckets.md
-- for bucket provisioning + RLS-equivalent policies.

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS receipt_url TEXT,
    ADD COLUMN IF NOT EXISTS receipt_uploaded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.payments.receipt_url IS
    'Public-relative path (NOT signed URL) to the receipt object in the payment-receipts Storage bucket. Format: ${user_id}/${tenant_id}/${payment_id}.{ext}';
COMMENT ON COLUMN public.payments.receipt_uploaded_at IS
    'Timestamp of last receipt upload. NULL means no receipt uploaded yet.';
