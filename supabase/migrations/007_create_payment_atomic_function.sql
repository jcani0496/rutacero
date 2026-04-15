-- Migration: Add atomic payment creation function
-- VUL-008: Prevents inconsistent state between payments and debts tables

DO $do$
BEGIN
    EXECUTE $fn$
    CREATE OR REPLACE FUNCTION create_payment_atomic(
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
    BEGIN
      -- Verify debt belongs to user (security check)
      SELECT balance, user_id INTO v_current_balance, v_debt_user_id
      FROM debts
      WHERE id = p_debt_id
      FOR UPDATE; -- Lock the row for update

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Debt not found';
      END IF;

      IF v_debt_user_id != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Debt does not belong to user';
      END IF;

      -- Calculate new balance
      v_new_balance := GREATEST(0, v_current_balance - p_amount);

      -- Determine new status
      IF v_new_balance = 0 THEN
        v_new_status := 'PAID_OFF';
      ELSE
        v_new_status := 'ACTIVE';
      END IF;

      -- Insert payment (atomic operation 1)
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
        p_payment_date::date,
        p_payment_method,
        NOW()
      )
      RETURNING id INTO v_payment_id;

      -- Update debt balance (atomic operation 2)
      UPDATE debts
      SET
        balance = v_new_balance,
        status = v_new_status,
        updated_at = NOW()
      WHERE id = p_debt_id;

      -- Return results
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
    COMMENT ON FUNCTION create_payment_atomic IS
    'Atomically creates a payment and updates the associated debt balance.\nPrevents inconsistent state by using a transaction.\nVUL-008 remediation.';
    $sql$;

    EXECUTE $sql$
    GRANT EXECUTE ON FUNCTION create_payment_atomic TO authenticated;
    $sql$;
END $do$;
