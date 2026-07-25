# Archived Supabase local stack (F6 cutover)

RutaCero no longer depends on `@supabase/*` at runtime. Production data/auth/storage
are Railway Postgres + better-auth + Railway Buckets.

This folder is kept as historical SQL migration source only.
**Do not** wire the app or CI back to this stack.

Remote Supabase project: pause or delete manually when ready (not automated).
