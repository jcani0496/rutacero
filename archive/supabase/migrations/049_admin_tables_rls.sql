-- 049_admin_tables_rls.sql
-- Audit 2026-07 (P1, CONFIRMED): migrations 015/019 created the admin
-- support tables without RLS. Through PostgREST, anyone holding the public
-- anon key could read support settings, insert auto-assign/escalation
-- rules, or delete saved views — no login required.
--
-- All application access to these tables goes through the service-role
-- client (admin-support.ts / support.ts), which bypasses RLS, so enabling
-- RLS with NO policies + revoking table grants shuts the PostgREST door
-- without touching any app path.

ALTER TABLE public.admin_support_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_support_rules ENABLE ROW LEVEL SECURITY;

-- Belt and suspenders: even without policies, drop the grants so a future
-- accidental policy can't widen access silently.
REVOKE ALL ON public.admin_support_settings FROM anon, authenticated;
REVOKE ALL ON public.admin_saved_views FROM anon, authenticated;
REVOKE ALL ON public.admin_support_rules FROM anon, authenticated;
