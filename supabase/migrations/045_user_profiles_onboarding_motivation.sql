-- Add optional onboarding motivation column to user_profiles for downstream personalization.
-- Captured at the (optional) motivation step of onboarding. NULL means the user
-- skipped the step or onboarded before this column existed.

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS onboarding_motivation TEXT
        CHECK (onboarding_motivation IS NULL
               OR onboarding_motivation IN ('STRESSED', 'SAVE_INTEREST', 'BIG_PURCHASE', 'UNDERSTAND_NUMBERS'));

COMMENT ON COLUMN public.user_profiles.onboarding_motivation IS
    'Optional motivation captured at onboarding for downstream personalization. NULL for users who skipped or onboarded before this column existed.';
