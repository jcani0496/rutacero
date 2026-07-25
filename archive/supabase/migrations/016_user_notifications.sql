-- User notifications for reminders and alerts

CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'PAYMENT_REMINDER',
        'PAYMENT_DUE',
        'OVERDUE',
        'MILESTONE',
        'PLAN_NUDGE',
        'SYSTEM'
    )),
    severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL', 'SUCCESS')),
    title TEXT NOT NULL,
    message TEXT,
    read BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user
    ON user_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_user_notifications_unread
    ON user_notifications(user_id, read, created_at DESC)
    WHERE read = false;

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
    ON user_notifications FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
    ON user_notifications FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Service role can insert notifications"
    ON user_notifications FOR INSERT
    WITH CHECK (true);
