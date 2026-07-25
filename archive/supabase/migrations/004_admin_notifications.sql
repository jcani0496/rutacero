-- Admin Notifications Table
-- Stores notifications for admins about system events
CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('NEW_USER', 'NEW_SUBSCRIPTION', 'SYSTEM_ALERT', 'EXPORT_COMPLETED')),
    title TEXT NOT NULL,
    message TEXT,
    read BOOLEAN DEFAULT false,
    admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread ON admin_notifications(admin_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON admin_notifications(created_at DESC);

-- RLS policies
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view their notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Admins can update their notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON admin_notifications;

-- Admins can see their own notifications
CREATE POLICY "Admins can view their notifications"
ON admin_notifications FOR SELECT
USING (admin_id IN (SELECT id FROM admin_users WHERE user_id = auth.uid()));

-- Admins can update (mark as read) their notifications
CREATE POLICY "Admins can update their notifications"
ON admin_notifications FOR UPDATE
USING (admin_id IN (SELECT id FROM admin_users WHERE user_id = auth.uid()));

-- System can insert notifications (via service role)
CREATE POLICY "Service role can insert notifications"
ON admin_notifications FOR INSERT
WITH CHECK (true);

-- Function to create notification for all admins
CREATE OR REPLACE FUNCTION notify_all_admins(
    p_type TEXT,
    p_title TEXT,
    p_message TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
    INSERT INTO admin_notifications (type, title, message, admin_id, metadata)
    SELECT p_type, p_title, p_message, id, p_metadata
    FROM admin_users
    WHERE is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Notify admins when new user signs up
CREATE OR REPLACE FUNCTION notify_on_new_user()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM notify_all_admins(
        'NEW_USER',
        'Nuevo usuario registrado',
        NEW.email,
        jsonb_build_object('user_id', NEW.id, 'email', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: The trigger on auth.users requires superuser/postgres role
-- This would be applied manually or via Supabase dashboard:
-- CREATE TRIGGER on_user_created
-- AFTER INSERT ON auth.users
-- FOR EACH ROW EXECUTE FUNCTION notify_on_new_user();
