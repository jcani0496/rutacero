-- Admin auth hardening:
-- 1) Add password rotation metadata for admin users.
-- 2) Allow authenticated users to read only their own user-channel lockout rows.

ALTER TABLE IF EXISTS admin_users
  ADD COLUMN IF NOT EXISTS password_rotated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS must_rotate_password boolean NOT NULL DEFAULT false;

UPDATE admin_users
SET password_rotated_at = COALESCE(password_rotated_at, updated_at, created_at, now())
WHERE password_rotated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_users_password_rotation
  ON admin_users(password_rotated_at);

DROP POLICY IF EXISTS "authenticated user can read own lockout row" ON auth_login_lockouts;
CREATE POLICY "authenticated user can read own lockout row"
  ON auth_login_lockouts
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND channel = 'user'
    AND principal = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );
