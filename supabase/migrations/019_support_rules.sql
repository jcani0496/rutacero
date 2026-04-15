-- Support automation rules

CREATE TABLE IF NOT EXISTS admin_support_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    category ticket_category NOT NULL,
    plan_code TEXT,
    set_priority ticket_priority,
    assign_role admin_role,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_support_rules_category
    ON admin_support_rules(category, is_active);

CREATE INDEX IF NOT EXISTS idx_admin_support_rules_plan
    ON admin_support_rules(plan_code);

CREATE TRIGGER update_admin_support_rules_updated_at
    BEFORE UPDATE ON admin_support_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
