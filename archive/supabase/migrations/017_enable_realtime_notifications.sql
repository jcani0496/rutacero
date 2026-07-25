-- Enable realtime for notifications tables

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_class c ON pr.prrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND n.nspname = 'public'
        AND c.relname = 'user_notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_class c ON pr.prrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND n.nspname = 'public'
        AND c.relname = 'admin_notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
    END IF;
  END IF;
END $$;
