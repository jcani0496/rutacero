-- Multi-tenant compatible atomic payment creation (SECURITY DEFINER)
-- - Uses auth.uid() to prevent impersonation
-- - Copies tenant_id from the debt record
-- - Enforces membership in the debt's tenant

DO $do$
BEGIN
  EXECUTE $fn$
  CREATE OR REPLACE FUNCTION public.create_payment_atomic(
    p_debt_id uuid,
    p_amount numeric,
    p_currency text,
    p_payment_date text,
    p_payment_method text DEFAULT NULL
  )
  RETURNS TABLE (
    payment_id uuid,
    payment_amount numeric,
    new_debt_balance numeric,
    new_debt_status text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
    v_payment_id uuid;
    v_user_id uuid;
    v_current_balance numeric;
    v_new_balance numeric;
    v_new_status text;
    v_debt_user_id uuid;
    v_debt_tenant_id uuid;
    v_payment_date date;
  BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
      RAISE EXCEPTION 'Invalid amount';
    END IF;

    IF p_currency IS NULL OR p_currency NOT IN ('GTQ', 'USD') THEN
      RAISE EXCEPTION 'Invalid currency';
    END IF;

    v_payment_date := p_payment_date::date;

    -- Verify debt belongs to caller and get tenant_id
    SELECT balance, user_id, tenant_id
      INTO v_current_balance, v_debt_user_id, v_debt_tenant_id
    FROM debts
    WHERE id = p_debt_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Debt not found';
    END IF;

    IF v_debt_user_id <> v_user_id THEN
      RAISE EXCEPTION 'Unauthorized: Debt does not belong to user';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM tenant_memberships m
      WHERE m.tenant_id = v_debt_tenant_id
        AND m.user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Not a member of tenant';
    END IF;

    v_new_balance := GREATEST(0, v_current_balance - p_amount);
    IF v_new_balance = 0 THEN
      v_new_status := 'PAID_OFF';
    ELSE
      v_new_status := 'ACTIVE';
    END IF;

    INSERT INTO payments (
      tenant_id,
      user_id,
      debt_id,
      amount,
      currency,
      payment_date,
      method,
      created_at
    )
    VALUES (
      v_debt_tenant_id,
      v_user_id,
      p_debt_id,
      p_amount,
      p_currency,
      v_payment_date,
      p_payment_method,
      NOW()
    )
    RETURNING id INTO v_payment_id;

    UPDATE debts
    SET
      balance = v_new_balance,
      status = v_new_status,
      updated_at = NOW()
    WHERE id = p_debt_id;

    RETURN QUERY
    SELECT
      v_payment_id,
      p_amount,
      v_new_balance,
      v_new_status;
  END;
  $$;
  $fn$;

  EXECUTE $sql$
  REVOKE ALL ON FUNCTION public.create_payment_atomic(uuid, numeric, text, text, text) FROM PUBLIC;
  $sql$;
  EXECUTE $sql$
  GRANT EXECUTE ON FUNCTION public.create_payment_atomic(uuid, numeric, text, text, text) TO authenticated;
  $sql$;
END $do$;

