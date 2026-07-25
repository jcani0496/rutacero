-- Migration: Add last_active_at tracking for performance optimization
-- Replaces expensive auth.admin.listUsers() calls with efficient DB queries

-- Add last_active_at column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Create index for efficient queries on recent activity
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_active
ON user_profiles(last_active_at DESC NULLS LAST);

-- Create index for created_at (used in growth queries)
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at
ON user_profiles(created_at DESC);

-- Initialize existing records with created_at as baseline
UPDATE user_profiles
SET last_active_at = created_at
WHERE last_active_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.last_active_at IS
'Timestamp of last user activity. Updated periodically via middleware (throttled to 10% of requests).';
