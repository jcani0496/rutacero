-- Support automation settings

ALTER TABLE admin_support_settings
    ADD COLUMN IF NOT EXISTS sla_escalation_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS stale_reassign_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS stale_reassign_hours INTEGER NOT NULL DEFAULT 24;
