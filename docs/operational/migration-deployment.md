# Migration Deployment to Production

Schema changes for RutaCero go through **Drizzle** against **Railway Postgres**.
The old Supabase `db push` workflow and `supabase/migrations/**` path are
retired; historical SQL lives under `archive/supabase/`.

## 1. How schema reaches production

1. Change Drizzle schema under `src/db/schema/` (and related seed/mappers).
2. Validate locally:
   ```bash
   npm run db:up:local
   npm run db:push:local
   npm run db:seed:local
   ```
3. Open a PR. CI (`.github/workflows/ci.yml`) runs lint/typecheck/tests/build
   and e2e against local Postgres + better-auth.
4. Merge to `main`. Railway auto-deploys the web service.
5. Apply schema on Railway Postgres with the same Drizzle push flow you use
   for ops (from a trusted machine / release step with `DATABASE_URL` pointing
   at production). Prefer expand/contract migrations for risky changes.

## 2. Secrets / env (Railway)

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Railway Postgres connection string for the web service / ops. |
| `BETTER_AUTH_SECRET` | App auth signing secret. |
| `AUTH_PROVIDER` / `NEXT_PUBLIC_AUTH_PROVIDER` | `better-auth` |
| `DATA_PROVIDER` | `drizzle` |
| `STORAGE_PROVIDER` / `NEXT_PUBLIC_STORAGE_PROVIDER` | `railway` |
| `CRON_SECRET` | Shared with GitHub Actions crons workflow. |

Do **not** set `SUPABASE_*`, `NEXT_PUBLIC_SUPABASE_*`, or Vercel project tokens.

## 3. Deploy surface

- **App:** Railway service `web` (`railway.json`), URL
  `https://web-production-b36897.up.railway.app` until a custom domain is wired.
- **Previews:** Railway PR environments (see CI workflow comments).
- **Crons:** `.github/workflows/crons.yml` → HTTP endpoints on the deployed app.

## 4. If a deploy / schema push fails

1. Check Railway deploy logs for the failed release.
2. Confirm `DATABASE_URL` and provider env vars on the service.
3. Roll forward with a fix PR, or roll back the Railway deployment to the last
   healthy release if the app is broken.
4. Never re-enable Supabase CLI `db push` against archived SQL.

## 5. Ordering tip

Prefer additive schema first (new nullable columns / tables), deploy code that
reads/writes safely, then tighten constraints in a follow-up. Avoid relying on
a hard dependency between an unfinished schema push and a live deploy window.

## 6. Related docs

- `docs/operational/backup-runbook.md`
- `docs/operational/cron-schedules.md`
- `docs/operational/storage-buckets.md`
- `archive/supabase/ARCHIVED.md`
