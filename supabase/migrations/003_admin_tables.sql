-- Migration: Admin Tables for Backoffice
-- Creates admin_users, support_tickets, and audit_logs tables

-- ============================================
-- ADMIN USERS TABLE
-- ============================================

CREATE TYPE admin_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'SUPPORT');

CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    role admin_role NOT NULL DEFAULT 'SUPPORT',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_users
    ADD COLUMN IF NOT EXISTS user_id UUID,
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE admin_users
    DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE admin_users
    ADD CONSTRAINT admin_users_role_check
        CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'ANALYST'));

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'admin_users' AND column_name = 'status'
    ) THEN
        UPDATE admin_users
        SET is_active = (status = 'ACTIVE')
        WHERE is_active IS NULL;
    END IF;
END $$;

UPDATE admin_users SET role = 'ADMIN' WHERE role = 'OPS_ADMIN';
UPDATE admin_users SET role = 'SUPPORT' WHERE role IN ('SUPPORT_AGENT', 'CONTENT_MANAGER');

-- Index for email lookup
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- ============================================
-- SUPPORT TICKETS TABLE
-- ============================================

CREATE TYPE ticket_status AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED');
CREATE TYPE ticket_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE ticket_category AS ENUM ('TECHNICAL', 'BILLING', 'ACCOUNT', 'FEATURE_REQUEST', 'OTHER');

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category ticket_category NOT NULL DEFAULT 'OTHER',
    status ticket_status NOT NULL DEFAULT 'OPEN',
    priority ticket_priority NOT NULL DEFAULT 'MEDIUM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

ALTER TABLE support_tickets
    ADD COLUMN IF NOT EXISTS assigned_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_admin_id);

-- ============================================
-- TICKET MESSAGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('USER', 'ADMIN')),
    sender_id UUID NOT NULL,
    message TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS admin_id UUID;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- ============================================
-- SUBSCRIPTIONS TABLE (for future use)
-- ============================================

CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED', 'TRIAL');
CREATE TYPE subscription_plan AS ENUM ('FREE', 'BASIC', 'PRO', 'ENTERPRISE');

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan subscription_plan NOT NULL DEFAULT 'FREE',
    status subscription_status NOT NULL DEFAULT 'ACTIVE',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    payment_provider VARCHAR(50),
    payment_provider_subscription_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_subscriptions_user ON subscriptions(user_id);

-- ============================================
-- RLS POLICIES
-- Admin tables - RLS disabled (accessed via service role server-side)
-- ============================================

-- Admin users table - NO RLS (server-side access only)
-- ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Audit logs - NO RLS (server-side access only)
-- ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Support tickets - users can see their own tickets
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'support_tickets'
          AND policyname = 'Users can view own tickets'
    ) THEN
        CREATE POLICY "Users can view own tickets"
            ON support_tickets FOR SELECT
            USING (user_id = auth.uid());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'support_tickets'
          AND policyname = 'Users can create tickets'
    ) THEN
        CREATE POLICY "Users can create tickets"
            ON support_tickets FOR INSERT
            WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

-- Ticket messages - users can see non-internal messages on their tickets
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'ticket_messages'
          AND policyname = 'Users can view non-internal messages on own tickets'
    ) THEN
        CREATE POLICY "Users can view non-internal messages on own tickets"
            ON ticket_messages FOR SELECT
            USING (
                is_internal = false AND
                EXISTS (
                    SELECT 1 FROM support_tickets t 
                    WHERE t.id = ticket_messages.ticket_id 
                    AND t.user_id = auth.uid()
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'ticket_messages'
          AND policyname = 'Users can add messages to own tickets'
    ) THEN
        CREATE POLICY "Users can add messages to own tickets"
            ON ticket_messages FOR INSERT
            WITH CHECK (
                sender_type = 'USER' AND
                sender_id = auth.uid() AND
                EXISTS (
                    SELECT 1 FROM support_tickets t 
                    WHERE t.id = ticket_messages.ticket_id 
                    AND t.user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- Subscriptions - users can view their own
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'subscriptions'
          AND policyname = 'Users can view own subscription'
    ) THEN
        CREATE POLICY "Users can view own subscription"
            ON subscriptions FOR SELECT
            USING (user_id = auth.uid());
    END IF;
END $$;

-- ============================================
-- NOTE: Do NOT seed default admin credentials in migrations.
-- Create admins explicitly via a local script/seed in dev.
-- ============================================

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_admin_users_updated_at'
    ) THEN
        CREATE TRIGGER update_admin_users_updated_at
            BEFORE UPDATE ON admin_users
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_support_tickets_updated_at'
    ) THEN
        CREATE TRIGGER update_support_tickets_updated_at
            BEFORE UPDATE ON support_tickets
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_subscriptions_updated_at'
    ) THEN
        CREATE TRIGGER update_subscriptions_updated_at
            BEFORE UPDATE ON subscriptions
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
