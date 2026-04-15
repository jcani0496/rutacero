-- Adds debt modeling fields (interest model, payment timing, fees, min payment rule)
-- and user personalization fields for more reliable plan recommendations.

-- ============================================
-- DEBTS: MODELING FIELDS
-- ============================================

ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS interest_model text,
  ADD COLUMN IF NOT EXISTS payment_day integer,
  ADD COLUMN IF NOT EXISTS monthly_fees numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_payment_rule jsonb;

-- Constraints (allow NULLs for backward compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'debts_interest_model_check'
  ) THEN
    ALTER TABLE public.debts
      ADD CONSTRAINT debts_interest_model_check
      CHECK (
        interest_model IS NULL OR interest_model IN (
          'MONTHLY_SIMPLE',
          'DAILY_SIMPLE',
          'DAILY_AVG_BALANCE'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'debts_payment_day_check'
  ) THEN
    ALTER TABLE public.debts
      ADD CONSTRAINT debts_payment_day_check
      CHECK (payment_day IS NULL OR (payment_day >= 1 AND payment_day <= 31));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'debts_monthly_fees_check'
  ) THEN
    ALTER TABLE public.debts
      ADD CONSTRAINT debts_monthly_fees_check
      CHECK (monthly_fees >= 0);
  END IF;
END $$;

-- Backfill sensible defaults for existing rows.
UPDATE public.debts
SET interest_model = CASE
  WHEN type = 'CREDIT_CARD' THEN 'DAILY_SIMPLE'
  ELSE 'MONTHLY_SIMPLE'
END
WHERE interest_model IS NULL;

UPDATE public.debts
SET payment_day = due_date
WHERE payment_day IS NULL AND due_date IS NOT NULL;

-- ============================================
-- USER PROFILES: PERSONALIZATION FIELDS
-- ============================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS motivation_level integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS risk_tolerance integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS safety_buffer_pct numeric(5,2) NOT NULL DEFAULT 10;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_motivation_level_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_motivation_level_check
      CHECK (motivation_level >= 1 AND motivation_level <= 5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_risk_tolerance_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_risk_tolerance_check
      CHECK (risk_tolerance >= 1 AND risk_tolerance <= 5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_safety_buffer_pct_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_safety_buffer_pct_check
      CHECK (safety_buffer_pct >= 0 AND safety_buffer_pct <= 50);
  END IF;
END $$;

