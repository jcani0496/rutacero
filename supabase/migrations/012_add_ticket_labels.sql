-- Add internal labels for support tickets

CREATE TABLE IF NOT EXISTS support_ticket_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_ticket_labels_unique
    ON support_ticket_labels(ticket_id, label);

CREATE INDEX IF NOT EXISTS idx_support_ticket_labels_ticket
    ON support_ticket_labels(ticket_id);

ALTER TABLE support_ticket_labels ENABLE ROW LEVEL SECURITY;
