-- Multi-tenant (workspace) support
-- Requirements:
-- - Tenant resolved by "current workspace selected" (user_profiles.current_tenant_id)
-- - Billing is per tenant
-- - Business data is personal (scoped to user_id) and additionally linked to a tenant_id for workspace separation

-- ============================================
-- Core tables
-- ============================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user_id ON public.tenant_memberships(user_id);

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS current_tenant_id uuid;

-- ============================================
-- Backfill "personal" tenant for every user
-- ============================================

-- Deterministic tenant id per user (for backfill). This avoids needing temporary tables.
-- Namespace UUID is fixed and arbitrary.
DO $do$
DECLARE
  v_namespace uuid := '2f3b4c6d-1111-4a7a-9b5a-2a4b6c8d9e10'::uuid;
BEGIN
  -- Ensure every auth user has a profile row.
  INSERT INTO public.user_profiles (user_id)
  SELECT u.id
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.user_id = u.id
  );

  -- Create personal tenant per user (id = uuid_v5(namespace, user_id)).
  INSERT INTO public.tenants (id, slug, name, created_by_user_id)
  SELECT
    uuid_generate_v5(v_namespace, u.id::text) AS id,
    'u_' || replace(u.id::text, '-', '') AS slug,
    'Personal' AS name,
    u.id AS created_by_user_id
  FROM auth.users u
  ON CONFLICT (id) DO NOTHING;

  -- Create membership (OWNER).
  INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
  SELECT
    uuid_generate_v5(v_namespace, u.id::text) AS tenant_id,
    u.id AS user_id,
    'OWNER' AS role
  FROM auth.users u
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  -- Set current tenant if missing.
  UPDATE public.user_profiles p
  SET current_tenant_id = uuid_generate_v5(v_namespace, p.user_id::text)
  WHERE p.current_tenant_id IS NULL;

  -- Backfill tenant_id across personal-data tables.
  -- For personal data, tenant_id + user_id defines the workspace scope.
  PERFORM 1;
END $do$;

-- ============================================
-- Add tenant_id columns to business tables
-- ============================================

ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.debt_documents ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.income_events ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.essential_expenses ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.variable_budget_targets ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.plan_items ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.forecasts ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.user_notifications ADD COLUMN IF NOT EXISTS tenant_id uuid;

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.ticket_messages ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- Billing per tenant
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS purchaser_user_id uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- ============================================
-- Backfill tenant_id values
-- ============================================

DO $do$
DECLARE
  v_namespace uuid := '2f3b4c6d-1111-4a7a-9b5a-2a4b6c8d9e10'::uuid;
BEGIN
  UPDATE public.debts d
  SET tenant_id = uuid_generate_v5(v_namespace, d.user_id::text)
  WHERE d.tenant_id IS NULL;

  UPDATE public.debt_documents dd
  SET tenant_id = uuid_generate_v5(v_namespace, dd.user_id::text)
  WHERE dd.tenant_id IS NULL;

  UPDATE public.payments p
  SET tenant_id = uuid_generate_v5(v_namespace, p.user_id::text)
  WHERE p.tenant_id IS NULL;

  UPDATE public.income_events ie
  SET tenant_id = uuid_generate_v5(v_namespace, ie.user_id::text)
  WHERE ie.tenant_id IS NULL;

  UPDATE public.essential_expenses ee
  SET tenant_id = uuid_generate_v5(v_namespace, ee.user_id::text)
  WHERE ee.tenant_id IS NULL;

  UPDATE public.variable_budget_targets vbt
  SET tenant_id = uuid_generate_v5(v_namespace, vbt.user_id::text)
  WHERE vbt.tenant_id IS NULL;

  UPDATE public.plans pl
  SET tenant_id = uuid_generate_v5(v_namespace, pl.user_id::text)
  WHERE pl.tenant_id IS NULL;

  UPDATE public.plan_items pi
  SET tenant_id = pl.tenant_id
  FROM public.plans pl
  WHERE pi.tenant_id IS NULL AND pl.id = pi.plan_id;

  UPDATE public.forecasts f
  SET tenant_id = uuid_generate_v5(v_namespace, f.user_id::text)
  WHERE f.tenant_id IS NULL;

  UPDATE public.alerts a
  SET tenant_id = uuid_generate_v5(v_namespace, a.user_id::text)
  WHERE a.tenant_id IS NULL;

  UPDATE public.user_notifications un
  SET tenant_id = uuid_generate_v5(v_namespace, un.user_id::text)
  WHERE un.tenant_id IS NULL;

  UPDATE public.support_tickets st
  SET tenant_id = uuid_generate_v5(v_namespace, st.user_id::text)
  WHERE st.tenant_id IS NULL AND st.user_id IS NOT NULL;

  UPDATE public.ticket_messages tm
  SET tenant_id = st.tenant_id
  FROM public.support_tickets st
  WHERE tm.tenant_id IS NULL AND st.id = tm.ticket_id;

  UPDATE public.subscriptions s
  SET
    tenant_id = uuid_generate_v5(v_namespace, s.user_id::text),
    purchaser_user_id = COALESCE(s.purchaser_user_id, s.user_id)
  WHERE s.tenant_id IS NULL;

  UPDATE public.invoices i
  SET tenant_id = uuid_generate_v5(v_namespace, i.user_id::text)
  WHERE i.tenant_id IS NULL;
END $do$;

-- ============================================
-- Constraints and indexes
-- ============================================

ALTER TABLE public.debts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.debt_documents ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.income_events ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.essential_expenses ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.variable_budget_targets ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.plans ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.plan_items ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.forecasts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.alerts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.user_notifications ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.subscriptions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_debts_tenant_user ON public.debts(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_user ON public.payments(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_plans_tenant_user ON public.plans(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_user ON public.alerts(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_tenant_user ON public.user_notifications(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON public.subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON public.invoices(tenant_id);

-- Billing uniqueness: 1 subscription row per tenant
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_key;
DROP INDEX IF EXISTS public.idx_subscriptions_user;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_tenant_unique ON public.subscriptions(tenant_id);

-- ============================================
-- RLS: tenants & memberships
-- ============================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view tenants they belong to" ON public.tenants;
CREATE POLICY "Users can view tenants they belong to"
  ON public.tenants FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenant_memberships m
      WHERE m.tenant_id = tenants.id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create tenants" ON public.tenants;
CREATE POLICY "Users can create tenants"
  ON public.tenants FOR INSERT
  WITH CHECK (created_by_user_id = auth.uid());

DROP POLICY IF EXISTS "Owners can update tenants" ON public.tenants;
CREATE POLICY "Owners can update tenants"
  ON public.tenants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenant_memberships m
      WHERE m.tenant_id = tenants.id
        AND m.user_id = auth.uid()
        AND m.role IN ('OWNER', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS "Users can view own memberships" ON public.tenant_memberships;
CREATE POLICY "Users can view own memberships"
  ON public.tenant_memberships FOR SELECT
  USING (user_id = auth.uid());

-- Allow a user to add themselves as OWNER only for tenants they created (bootstrap).
DROP POLICY IF EXISTS "Users can bootstrap own membership" ON public.tenant_memberships;
CREATE POLICY "Users can bootstrap own membership"
  ON public.tenant_memberships FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'OWNER'
    AND EXISTS (
      SELECT 1
      FROM public.tenants t
      WHERE t.id = tenant_memberships.tenant_id
        AND t.created_by_user_id = auth.uid()
    )
  );

-- Service role can manage memberships (invites/admin tooling)
DROP POLICY IF EXISTS "Service role can manage memberships" ON public.tenant_memberships;
CREATE POLICY "Service role can manage memberships"
  ON public.tenant_memberships FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- RLS: user_profiles current tenant selection
-- ============================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      current_tenant_id IS NULL OR EXISTS (
        SELECT 1 FROM public.tenant_memberships m
        WHERE m.tenant_id = current_tenant_id
          AND m.user_id = auth.uid()
      )
    )
  );

-- ============================================
-- RLS: personal data (tenant_id + user_id)
-- ============================================

-- debts
DROP POLICY IF EXISTS "Users can view own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can insert own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can update own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can delete own debts" ON public.debts;

CREATE POLICY "Users can view own debts" ON public.debts FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = debts.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own debts" ON public.debts FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = debts.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can update own debts" ON public.debts FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = debts.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own debts" ON public.debts FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = debts.tenant_id AND m.user_id = auth.uid())
  );

-- payments
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can delete own payments" ON public.payments;

CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = payments.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own payments" ON public.payments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = payments.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own payments" ON public.payments FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = payments.tenant_id AND m.user_id = auth.uid())
  );

-- income_events
DROP POLICY IF EXISTS "Users can view own income" ON public.income_events;
DROP POLICY IF EXISTS "Users can insert own income" ON public.income_events;
DROP POLICY IF EXISTS "Users can update own income" ON public.income_events;
DROP POLICY IF EXISTS "Users can delete own income" ON public.income_events;

CREATE POLICY "Users can view own income" ON public.income_events FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = income_events.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own income" ON public.income_events FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = income_events.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can update own income" ON public.income_events FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = income_events.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own income" ON public.income_events FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = income_events.tenant_id AND m.user_id = auth.uid())
  );

-- essential_expenses
DROP POLICY IF EXISTS "Users can view own expenses" ON public.essential_expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON public.essential_expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON public.essential_expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON public.essential_expenses;

CREATE POLICY "Users can view own expenses" ON public.essential_expenses FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = essential_expenses.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own expenses" ON public.essential_expenses FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = essential_expenses.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can update own expenses" ON public.essential_expenses FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = essential_expenses.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own expenses" ON public.essential_expenses FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = essential_expenses.tenant_id AND m.user_id = auth.uid())
  );

-- variable_budget_targets
DROP POLICY IF EXISTS "Users can view own budgets" ON public.variable_budget_targets;
DROP POLICY IF EXISTS "Users can insert own budgets" ON public.variable_budget_targets;
DROP POLICY IF EXISTS "Users can update own budgets" ON public.variable_budget_targets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON public.variable_budget_targets;

CREATE POLICY "Users can view own budgets" ON public.variable_budget_targets FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = variable_budget_targets.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own budgets" ON public.variable_budget_targets FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = variable_budget_targets.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can update own budgets" ON public.variable_budget_targets FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = variable_budget_targets.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own budgets" ON public.variable_budget_targets FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = variable_budget_targets.tenant_id AND m.user_id = auth.uid())
  );

-- plans
DROP POLICY IF EXISTS "Users can view own plans" ON public.plans;
DROP POLICY IF EXISTS "Users can insert own plans" ON public.plans;
DROP POLICY IF EXISTS "Users can update own plans" ON public.plans;

CREATE POLICY "Users can view own plans" ON public.plans FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = plans.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own plans" ON public.plans FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = plans.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can update own plans" ON public.plans FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = plans.tenant_id AND m.user_id = auth.uid())
  );

-- plan_items (via plan ownership)
DROP POLICY IF EXISTS "Users can view own plan items" ON public.plan_items;
DROP POLICY IF EXISTS "Users can insert own plan items" ON public.plan_items;

CREATE POLICY "Users can view own plan items" ON public.plan_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.plans pl
      WHERE pl.id = plan_items.plan_id
        AND pl.user_id = auth.uid()
        AND pl.tenant_id = plan_items.tenant_id
    )
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = plan_items.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own plan items" ON public.plan_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.plans pl
      WHERE pl.id = plan_items.plan_id
        AND pl.user_id = auth.uid()
        AND pl.tenant_id = plan_items.tenant_id
    )
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = plan_items.tenant_id AND m.user_id = auth.uid())
  );

-- forecasts
DROP POLICY IF EXISTS "Users can view own forecasts" ON public.forecasts;
DROP POLICY IF EXISTS "Users can insert own forecasts" ON public.forecasts;

CREATE POLICY "Users can view own forecasts" ON public.forecasts FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = forecasts.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own forecasts" ON public.forecasts FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = forecasts.tenant_id AND m.user_id = auth.uid())
  );

-- alerts
DROP POLICY IF EXISTS "Users can view own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can update own alerts" ON public.alerts;

CREATE POLICY "Users can view own alerts" ON public.alerts FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = alerts.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can update own alerts" ON public.alerts FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = alerts.tenant_id AND m.user_id = auth.uid())
  );

-- debt_documents
DROP POLICY IF EXISTS "Users can view own debt documents" ON public.debt_documents;
DROP POLICY IF EXISTS "Users can insert own debt documents" ON public.debt_documents;
DROP POLICY IF EXISTS "Users can delete own debt documents" ON public.debt_documents;

CREATE POLICY "Users can view own debt documents" ON public.debt_documents FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = debt_documents.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own debt documents" ON public.debt_documents FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = debt_documents.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own debt documents" ON public.debt_documents FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = debt_documents.tenant_id AND m.user_id = auth.uid())
  );

-- support_tickets (personal)
DROP POLICY IF EXISTS "Users can view own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON public.support_tickets;

CREATE POLICY "Users can view own tickets" ON public.support_tickets FOR SELECT
  USING (
    user_id = auth.uid()
    AND tenant_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = support_tickets.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can create tickets" ON public.support_tickets FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = support_tickets.tenant_id AND m.user_id = auth.uid())
  );

-- ticket_messages (personal via ticket ownership)
DROP POLICY IF EXISTS "Users can view non-internal messages on own tickets" ON public.ticket_messages;
DROP POLICY IF EXISTS "Users can add messages to own tickets" ON public.ticket_messages;

CREATE POLICY "Users can view non-internal messages on own tickets" ON public.ticket_messages FOR SELECT
  USING (
    is_internal = false
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = ticket_messages.ticket_id
        AND t.user_id = auth.uid()
        AND t.tenant_id = ticket_messages.tenant_id
    )
  );
CREATE POLICY "Users can add messages to own tickets" ON public.ticket_messages FOR INSERT
  WITH CHECK (
    sender_type = 'USER'
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = ticket_messages.ticket_id
        AND t.user_id = auth.uid()
        AND t.tenant_id = ticket_messages.tenant_id
    )
  );

-- user_notifications (personal)
DROP POLICY IF EXISTS "Users can view own notifications" ON public.user_notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.user_notifications;

CREATE POLICY "Users can view own notifications"
  ON public.user_notifications FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = user_notifications.tenant_id AND m.user_id = auth.uid())
  );
CREATE POLICY "Users can update own notifications"
  ON public.user_notifications FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = user_notifications.tenant_id AND m.user_id = auth.uid())
  );

-- Billing tables
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;

CREATE POLICY "Members can view tenant subscription"
  ON public.subscriptions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = subscriptions.tenant_id AND m.user_id = auth.uid())
  );

CREATE POLICY "Service role can write subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Members can view tenant invoices"
  ON public.invoices FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = invoices.tenant_id AND m.user_id = auth.uid())
  );

CREATE POLICY "Service role can write invoices"
  ON public.invoices FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

