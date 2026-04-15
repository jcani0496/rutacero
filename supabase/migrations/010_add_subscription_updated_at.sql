-- Add updated_at column to subscriptions for admin trigger compatibility
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE subscriptions
SET updated_at = COALESCE(updated_at, NOW());
