-- Remove legacy RPC signature that accepted an explicit user_id parameter.
-- The v2 signature derives auth.uid() and tenant_id safely.

DROP FUNCTION IF EXISTS public.create_payment_atomic(
  p_user_id uuid,
  p_debt_id uuid,
  p_amount numeric,
  p_currency text,
  p_payment_date text,
  p_payment_method text
);

