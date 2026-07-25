-- Ensure tenants.id can be generated server-side for new workspaces
-- (migration 024 created tenants.id without a default, which makes inserts require an explicit id).

ALTER TABLE public.tenants
  ALTER COLUMN id SET DEFAULT uuid_generate_v4();

