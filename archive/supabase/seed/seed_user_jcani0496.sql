BEGIN;

DO $seed$
DECLARE
  v_user_id uuid := '50693697-37e6-4ced-9624-4a17339b0aa1';
  v_credit_id uuid;
  v_loan_id uuid;
  v_installment_id uuid;
  v_plan_id uuid;
BEGIN
  -- Clean existing financial data for a fresh seed
  DELETE FROM plan_items WHERE plan_id IN (SELECT id FROM plans WHERE user_id = v_user_id);
  DELETE FROM plans WHERE user_id = v_user_id;
  DELETE FROM payments WHERE user_id = v_user_id;
  DELETE FROM variable_budget_targets WHERE user_id = v_user_id;
  DELETE FROM essential_expenses WHERE user_id = v_user_id;
  DELETE FROM income_events WHERE user_id = v_user_id;
  DELETE FROM debts WHERE user_id = v_user_id;
  DELETE FROM alerts WHERE user_id = v_user_id;
  DELETE FROM user_notifications WHERE user_id = v_user_id;

  -- Debts (typical Guatemala household profile)
  INSERT INTO debts (
    user_id,
    type,
    creditor,
    balance,
    currency,
    apr,
    min_payment,
    statement_date,
    due_date,
    next_payment_date,
    installment_count,
    installments_left,
    fixed_payment,
    status,
    notes,
    category
  ) VALUES (
    v_user_id,
    'CREDIT_CARD',
    'Banco Industrial',
    4800.00,
    'GTQ',
    48.00,
    250.00,
    18,
    28,
    '2026-02-28',
    NULL,
    NULL,
    NULL,
    'ACTIVE',
    'Tarjeta principal para gastos corrientes.',
    'Tarjeta de crédito'
  ) RETURNING id INTO v_credit_id;

  INSERT INTO debts (
    user_id,
    type,
    creditor,
    balance,
    currency,
    apr,
    min_payment,
    statement_date,
    due_date,
    next_payment_date,
    installment_count,
    installments_left,
    fixed_payment,
    status,
    notes,
    category
  ) VALUES (
    v_user_id,
    'LOAN',
    'Banrural',
    12000.00,
    'GTQ',
    32.00,
    600.00,
    1,
    10,
    '2026-02-10',
    24,
    18,
    700.00,
    'ACTIVE',
    'Préstamo personal para imprevistos familiares.',
    'Préstamo personal'
  ) RETURNING id INTO v_loan_id;

  INSERT INTO debts (
    user_id,
    type,
    creditor,
    balance,
    currency,
    apr,
    min_payment,
    statement_date,
    due_date,
    next_payment_date,
    installment_count,
    installments_left,
    fixed_payment,
    status,
    notes,
    category
  ) VALUES (
    v_user_id,
    'INSTALLMENT',
    'Tiendas Max',
    3200.00,
    'GTQ',
    22.00,
    200.00,
    25,
    5,
    '2026-02-05',
    12,
    8,
    400.00,
    'ACTIVE',
    'Compra de electrodomésticos a cuotas.',
    'Cuotas'
  ) RETURNING id INTO v_installment_id;

  -- Income events (monthly income + small variable)
  INSERT INTO income_events (user_id, date, amount, currency, type, source, notes)
  VALUES
    (v_user_id, '2025-11-30', 6500.00, 'GTQ', 'FIXED', 'Salario', 'Ingreso mensual'),
    (v_user_id, '2025-12-30', 6500.00, 'GTQ', 'FIXED', 'Salario', 'Ingreso mensual'),
    (v_user_id, '2026-01-30', 6500.00, 'GTQ', 'FIXED', 'Salario', 'Ingreso mensual'),
    (v_user_id, '2026-01-15', 450.00, 'GTQ', 'VARIABLE', 'Comisiones', 'Ingresos extra');

  -- Essential expenses (average Guatemala household)
  INSERT INTO essential_expenses (user_id, name, amount, frequency, next_date, currency, expense_type, category, actual_amount)
  VALUES
    (v_user_id, 'Alquiler', 1800.00, 'MONTHLY', '2026-02-01', 'GTQ', 'NEED', 'Vivienda', 1800.00),
    (v_user_id, 'Alimentación', 1400.00, 'MONTHLY', '2026-02-05', 'GTQ', 'NEED', 'Hogar', 1200.00),
    (v_user_id, 'Transporte', 600.00, 'MONTHLY', '2026-02-03', 'GTQ', 'NEED', 'Movilidad', 540.00),
    (v_user_id, 'Servicios básicos', 350.00, 'MONTHLY', '2026-02-08', 'GTQ', 'NEED', 'Servicios', 320.00),
    (v_user_id, 'Internet y teléfono', 250.00, 'MONTHLY', '2026-02-12', 'GTQ', 'NEED', 'Servicios', 250.00),
    (v_user_id, 'Educación', 400.00, 'MONTHLY', '2026-02-20', 'GTQ', 'NEED', 'Educación', 350.00),
    (v_user_id, 'Salud', 200.00, 'MONTHLY', '2026-02-25', 'GTQ', 'NEED', 'Salud', 120.00);

  -- Variable budget targets
  INSERT INTO variable_budget_targets (user_id, category, amount, period, currency, actual_amount)
  VALUES
    (v_user_id, 'Supermercado', 1200.00, 'MONTHLY', 'GTQ', 980.00),
    (v_user_id, 'Transporte', 600.00, 'MONTHLY', 'GTQ', 540.00),
    (v_user_id, 'Salud', 300.00, 'MONTHLY', 'GTQ', 120.00),
    (v_user_id, 'Educación', 400.00, 'MONTHLY', 'GTQ', 350.00),
    (v_user_id, 'Ocio', 300.00, 'MONTHLY', 'GTQ', 280.00);

  -- Payments (recent history)
  INSERT INTO payments (user_id, debt_id, amount, currency, payment_date, method)
  VALUES
    (v_user_id, v_credit_id, 300.00, 'GTQ', '2025-12-28', 'Transferencia'),
    (v_user_id, v_credit_id, 260.00, 'GTQ', '2026-01-20', 'Transferencia'),
    (v_user_id, v_loan_id, 700.00, 'GTQ', '2025-12-10', 'Débito'),
    (v_user_id, v_loan_id, 700.00, 'GTQ', '2026-01-10', 'Débito'),
    (v_user_id, v_installment_id, 400.00, 'GTQ', '2025-12-05', 'Efectivo'),
    (v_user_id, v_installment_id, 400.00, 'GTQ', '2026-01-05', 'Efectivo');

  -- Plan (hybrid)
  INSERT INTO plans (
    user_id,
    strategy,
    engine_version,
    active,
    assumptions,
    horizon_periods,
    eta_debt_free,
    interest_estimate,
    avg_payment
  ) VALUES (
    v_user_id,
    'HYBRID',
    'v1',
    true,
    '{"monthly_income":6500,"monthly_essentials":4750,"buffer":300}',
    8,
    '2027-06-30',
    6500.00,
    1600.00
  ) RETURNING id INTO v_plan_id;

  -- Plan items (next month focus)
  INSERT INTO plan_items (plan_id, period_start, period_end, debt_id, planned_amount, currency, priority_order, is_focus, rationale)
  VALUES
    (v_plan_id, '2026-02-01', '2026-02-28', v_credit_id, 450.00, 'GTQ', 1, true, '{"reason":"Mayor APR"}'),
    (v_plan_id, '2026-02-01', '2026-02-28', v_loan_id, 700.00, 'GTQ', 2, false, '{"reason":"Pago fijo"}'),
    (v_plan_id, '2026-02-01', '2026-02-28', v_installment_id, 400.00, 'GTQ', 3, false, '{"reason":"Cuota mensual"}');

  -- Alerts
  INSERT INTO alerts (user_id, type, severity, period_start, message, status)
  VALUES
    (v_user_id, 'PAYMENT_DUE', 'MEDIUM', '2026-02-01', 'Tu tarjeta vence el 28 de febrero. Considera adelantar Q200 extra.', 'ACTIVE'),
    (v_user_id, 'BUDGET_EXCEEDED', 'LOW', '2026-02-01', 'Has utilizado 90% del presupuesto de transporte este mes.', 'ACTIVE');
END $seed$;

COMMIT;
