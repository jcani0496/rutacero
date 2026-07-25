-- Security hardening
-- - Fix SECURITY DEFINER RPC to prevent user impersonation.
-- - Restrict notification inserts to service_role only.
-- - Enable RLS on sensitive admin/system tables to avoid accidental exposure via PostgREST.

DO $do$
BEGIN
  -- ============================================
  -- Harden create_payment_atomic (VUL-008 follow-up)
  -- ============================================
  EXECUTE $fn$
  CREATE OR REPLACE FUNCTION public.create_payment_atomic(
    p_user_id uuid,
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
    v_current_balance numeric;
    v_new_balance numeric;
    v_new_status text;
    v_debt_user_id uuid;
    v_payment_date date;
  BEGIN
    -- Prevent user impersonation: caller must match auth.uid().
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
      RAISE EXCEPTION 'Unauthorized: user mismatch';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
      RAISE EXCEPTION 'Invalid amount';
    END IF;

    IF p_currency IS NULL OR p_currency NOT IN ('GTQ', 'USD') THEN
      RAISE EXCEPTION 'Invalid currency';
    END IF;

    -- Validate/parse date early for clearer errors.
    v_payment_date := p_payment_date::date;

    -- Verify debt belongs to user
    SELECT balance, user_id INTO v_current_balance, v_debt_user_id
    FROM debts
    WHERE id = p_debt_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Debt not found';
    END IF;

    IF v_debt_user_id <> p_user_id THEN
      RAISE EXCEPTION 'Unauthorized: Debt does not belong to user';
    END IF;

    v_new_balance := GREATEST(0, v_current_balance - p_amount);

    IF v_new_balance = 0 THEN
      v_new_status := 'PAID_OFF';
    ELSE
      v_new_status := 'ACTIVE';
    END IF;

    INSERT INTO payments (
      user_id,
      debt_id,
      amount,
      currency,
      payment_date,
      method,
      created_at
    )
    VALUES (
      p_user_id,
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
  REVOKE ALL ON FUNCTION public.create_payment_atomic(uuid, uuid, numeric, text, text, text) FROM PUBLIC;
  $sql$;
  EXECUTE $sql$
  GRANT EXECUTE ON FUNCTION public.create_payment_atomic(uuid, uuid, numeric, text, text, text) TO authenticated;
  $sql$;

  -- ============================================
  -- Fix notifications RLS: inserts must be service_role only
  -- ============================================
  EXECUTE $sql$
  ALTER TABLE IF EXISTS public.user_notifications ENABLE ROW LEVEL SECURITY;
  $sql$;
  EXECUTE $sql$
  DROP POLICY IF EXISTS "Service role can insert notifications" ON public.user_notifications;
  $sql$;
  EXECUTE $sql$
  CREATE POLICY "Service role can insert notifications"
    ON public.user_notifications FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
  $sql$;

  EXECUTE $sql$
  ALTER TABLE IF EXISTS public.admin_notifications ENABLE ROW LEVEL SECURITY;
  $sql$;
  EXECUTE $sql$
  DROP POLICY IF EXISTS "Admins can view their notifications" ON public.admin_notifications;
  $sql$;
  EXECUTE $sql$
  DROP POLICY IF EXISTS "Admins can update their notifications" ON public.admin_notifications;
  $sql$;
  EXECUTE $sql$
  DROP POLICY IF EXISTS "Service role can insert notifications" ON public.admin_notifications;
  $sql$;

  -- Keep admin_notifications accessible only via service_role (app server).
  EXECUTE $sql$
  CREATE POLICY "Service role only"
    ON public.admin_notifications
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
  $sql$;

  -- ============================================
  -- Lock down sensitive admin/system tables
  -- ============================================
  EXECUTE $sql$ ALTER TABLE IF EXISTS public.admin_users ENABLE ROW LEVEL SECURITY; $sql$;
  EXECUTE $sql$ ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY; $sql$;
  EXECUTE $sql$ ALTER TABLE IF EXISTS public.payment_webhook_events ENABLE ROW LEVEL SECURITY; $sql$;
  EXECUTE $sql$ ALTER TABLE IF EXISTS public.engine_configs ENABLE ROW LEVEL SECURITY; $sql$;
  EXECUTE $sql$ ALTER TABLE IF EXISTS public.feature_flags ENABLE ROW LEVEL SECURITY; $sql$;
END $do$;

