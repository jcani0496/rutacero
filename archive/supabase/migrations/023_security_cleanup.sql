-- Security cleanup
-- - Disable legacy seeded default admin user (if present)
-- - Harden SECURITY DEFINER functions by setting a fixed search_path

DO $do$
BEGIN
  -- Disable the legacy seeded admin account (if it exists).
  -- Admins must be created explicitly in dev via scripts/seeds.
  UPDATE public.admin_users
  SET is_active = false
  WHERE email = 'admin@rutacero.gt';

  -- Harden SECURITY DEFINER functions to avoid search_path injection.
  EXECUTE $fn$
  CREATE OR REPLACE FUNCTION public.notify_all_admins(
      p_type TEXT,
      p_title TEXT,
      p_message TEXT DEFAULT NULL,
      p_metadata JSONB DEFAULT '{}'::jsonb
  )
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  BEGIN
      INSERT INTO admin_notifications (type, title, message, admin_id, metadata)
      SELECT p_type, p_title, p_message, id, p_metadata
      FROM admin_users
      WHERE is_active = true;
  END;
  $$;
  $fn$;

  EXECUTE $fn$
  CREATE OR REPLACE FUNCTION public.notify_on_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  BEGIN
      PERFORM notify_all_admins(
          'NEW_USER',
          'Nuevo usuario registrado',
          NEW.email,
          jsonb_build_object('user_id', NEW.id, 'email', NEW.email)
      );
      RETURN NEW;
  END;
  $$;
  $fn$;

  -- Best effort: prevent execution by untrusted roles.
  EXECUTE $sql$ REVOKE ALL ON FUNCTION public.notify_all_admins(text, text, text, jsonb) FROM PUBLIC; $sql$;
  EXECUTE $sql$ REVOKE ALL ON FUNCTION public.notify_on_new_user() FROM PUBLIC; $sql$;
END $do$;

