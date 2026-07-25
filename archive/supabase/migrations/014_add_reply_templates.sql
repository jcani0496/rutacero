-- Admin reply templates for support tickets

CREATE TABLE IF NOT EXISTS admin_reply_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_reply_templates_active
    ON admin_reply_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_admin_reply_templates_created_by
    ON admin_reply_templates(created_by);

CREATE TRIGGER update_admin_reply_templates_updated_at
    BEFORE UPDATE ON admin_reply_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE admin_reply_templates ENABLE ROW LEVEL SECURITY;
