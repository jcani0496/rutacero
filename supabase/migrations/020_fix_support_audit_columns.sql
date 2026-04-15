-- Add missing columns to align support_tickets and audit_logs with app expectations

ALTER TABLE support_tickets
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

UPDATE support_tickets
SET description = body
WHERE description IS NULL;

ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS details JSONB,
    ADD COLUMN IF NOT EXISTS admin_id UUID;

UPDATE audit_logs
SET details = metadata
WHERE details IS NULL;

UPDATE audit_logs
SET admin_id = admin_user_id
WHERE admin_id IS NULL AND admin_user_id IS NOT NULL;
