-- 040_manual_payment_grants_unique_bank_reference.sql
-- Tighten manual_payment_grants integrity: bank_reference is required and unique.
-- Concurrent admin grants for the same transfer reference are rejected at the DB level.

-- Backfill any pre-existing NULL bank_reference (none expected on a fresh DB; defensive).
UPDATE public.manual_payment_grants
SET bank_reference = 'BACKFILL-' || id::text
WHERE bank_reference IS NULL;

ALTER TABLE public.manual_payment_grants
    ALTER COLUMN bank_reference SET NOT NULL;

ALTER TABLE public.manual_payment_grants
    ADD CONSTRAINT uq_manual_grants_bank_reference UNIQUE (bank_reference);

COMMENT ON COLUMN public.manual_payment_grants.bank_reference
    IS 'Required, unique. Each bank transfer reference can be used for at most one grant.';
