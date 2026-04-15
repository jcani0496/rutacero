-- Progressive login lockout state (user/admin)
-- This table is managed only by server-side service-role operations.

CREATE TABLE IF NOT EXISTS auth_login_lockouts (
  channel text NOT NULL CHECK (channel IN ('user', 'admin')),
  principal text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  lock_level integer NOT NULL DEFAULT 0 CHECK (lock_level >= 0),
  locked_until timestamptz,
  last_failed_at timestamptz,
  last_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel, principal)
);

CREATE INDEX IF NOT EXISTS idx_auth_login_lockouts_locked_until
  ON auth_login_lockouts (locked_until)
  WHERE locked_until IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'update_auth_login_lockouts_updated_at'
    ) THEN
      CREATE TRIGGER update_auth_login_lockouts_updated_at
        BEFORE UPDATE ON auth_login_lockouts
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
  ELSIF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'update_auth_login_lockouts_updated_at'
    ) THEN
      CREATE TRIGGER update_auth_login_lockouts_updated_at
        BEFORE UPDATE ON auth_login_lockouts
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
    END IF;
  END IF;
END $$;

ALTER TABLE auth_login_lockouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role manages auth_login_lockouts" ON auth_login_lockouts;
CREATE POLICY "service role manages auth_login_lockouts"
  ON auth_login_lockouts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
