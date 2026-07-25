-- Support settings and saved views for admin support

CREATE TABLE IF NOT EXISTS admin_support_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auto_assign_enabled BOOLEAN NOT NULL DEFAULT false,
    auto_assign_strategy TEXT NOT NULL DEFAULT 'LOAD_BALANCED'
        CHECK (auto_assign_strategy IN ('LOAD_BALANCED', 'ROUND_ROBIN')),
    auto_assign_priorities TEXT[] NOT NULL DEFAULT ARRAY['URGENT', 'HIGH', 'MEDIUM', 'LOW']::text[],
    last_round_robin_index INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_support_settings_updated
    ON admin_support_settings(updated_at DESC);

CREATE TRIGGER update_admin_support_settings_updated_at
    BEFORE UPDATE ON admin_support_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS admin_saved_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_saved_views_admin
    ON admin_saved_views(admin_id);
