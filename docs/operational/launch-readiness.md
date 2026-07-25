# RutaCero — Launch Readiness Checklist

Operacional. Dueño: founder técnico (jcani0496). Checklist para pasar de
"código completo" a "usuarios reales en producción".

**Stack actual (2026-07):** Railway (web + Postgres + Buckets) + better-auth +
Drizzle. Los proyectos remotos de Supabase y Vercel fueron eliminados — no
reintroducir `SUPABASE_*` ni linkage de Vercel.

Convención de estado:
- ✅ hecho y verificado.
- ⚠️ parcialmente listo o bloqueado por dependencia externa.
- ❌ pendiente.

## 0. Estado actual (snapshot)

Fecha del snapshot: 2026-07-25.

| Área | Estado | Notas |
|------|--------|-------|
| Hosting | ✅ | Railway `web` → `https://web-production-b36897.up.railway.app` |
| DB / Auth / Storage | ✅ | Railway Postgres + better-auth + Railway Buckets |
| CI | ✅ | `.github/workflows/ci.yml` (Postgres + better-auth e2e) |
| Crons | ✅ | `.github/workflows/crons.yml` (no Vercel Cron) |
| Sentry SDK | ✅ | `instrumentation-client.ts`; vars en Railway |
| Storage bucket `payment-receipts` | ✅ | Railway Bucket; ver `storage-buckets.md` |
| Phase F WhatsApp | ⚠️ | Bloqueado en Meta Business |
| Dominio comprado / SPF-DKIM | ❌/⚠️ | Ver `email-domain.md` |
| FEL certificador | ⚠️ | Manual hasta primer cobro; `fel-emission-policy.md` |

## 1. Pre-launch

### 1.1 Infraestructura

- [ ] Railway project `rutacero` online; service `web` healthy (`/api/healthz`).
- [ ] Auto-deploy desde `main` vía integración GitHub → Railway.
- [ ] Bucket `payment-receipts` provisionado; `STORAGE_PROVIDER=railway`.
- [ ] Schema Drizzle aplicado en prod (`DATABASE_URL` Railway Postgres).
- [ ] Dominio comprado y DNS → Railway (candidato `rutacero.app`).
- [ ] SPF + DKIM verificados en Resend (`email-domain.md`).

### 1.2 Env vars (Railway)

Setear en el servicio `web` (production). Previews pueden usar mocks.

#### Core

| Var | Requerida | Notas |
|-----|-----------|-------|
| `DATABASE_URL` | Sí | Railway Postgres |
| `BETTER_AUTH_SECRET` | Sí | **Secret** |
| `AUTH_PROVIDER` / `NEXT_PUBLIC_AUTH_PROVIDER` | Sí | `better-auth` |
| `DATA_PROVIDER` | Sí | `drizzle` |
| `STORAGE_PROVIDER` / `NEXT_PUBLIC_STORAGE_PROVIDER` | Sí | `railway` |
| `NEXT_PUBLIC_APP_URL` | Sí | Dominio canónico o URL Railway actual |
| `CRON_SECRET` | Sí | Shared con GitHub Actions crons |
| `ADMIN_JWT_SECRET` | Sí | **Secret** |

#### Recurrente / Google Play / Resend / Sentry / bank transfer

Ver `.env.example` (mismas keys; sin `SUPABASE_*`).

`BANK_TRANSFER_INSTRUCTIONS_JSON` es crítico: sin JSON válido `/pago-manual`
devuelve 503.

### 1.3 Schema y datos

- [ ] Schema Drizzle al día en prod (ver `migration-deployment.md`).
- [ ] Admin seed con `scripts/seed-admin.js` apuntado a prod (una vez).
- [ ] Backup pre-launch: `npm run backup:prod` → `{"status":"success"}`
      (`backup-runbook.md`).

### 1.4 Cron jobs

Fuente de verdad: `.github/workflows/crons.yml` + `cron-schedules.md`.

| Path | UTC | GT |
|------|-----|----|
| `/api/cron/security-maintenance` | `0 6 * * *` | 00:00 |
| `/api/cron/payment-reminders` | `0 12 * * *` | 06:00 |
| `/api/cron/lifecycle` | `30 12 * * *` | 06:30 |
| `/api/cron/process-deletions` | `0 13 * * *` | 07:00 |

- [ ] Secrets `CRON_SECRET` + `CRON_APP_URL` en GitHub.
- [ ] Tras 24h post-launch, verificar runs 200 en Actions + logs Railway.

### 1.5 Observabilidad

- [ ] Sentry recibe eventos; 4 reglas Active en `production`
      (`src/lib/observability/sentry-alerts.md`).
- [ ] `/api/healthz` y `/api/readiness` 200 desde fuera de Railway.
- [ ] Logger redacta PII financiera (`src/lib/logger.ts`).

### 1.6 Legal y compliance GT

- [ ] Disclaimer financiero en Plan / Forecast / emails.
- [ ] `/privacy` y `/terms` publicados.
- [ ] Política FEL leída (`fel-emission-policy.md`).
- [ ] Self-service delete-account + cron `process-deletions`.
- [ ] Export CSV disponible (portabilidad).

### 1.7 Smoke tests por surface

#### Landing (`/`)
- [ ] H1 above-the-fold; FAQ; CTAs → `/signup`; footer legal; sticky mobile nav.

#### Auth
- [ ] Signup/login/onboarding/forgot-password; lockout progresivo; FirstRunWelcome.

#### Dashboard / pago manual / comprobantes / account deletion / admin
- [ ] Misma checklist funcional que antes del cutover (crear deuda, pago
      manual sin 503, upload receipt vía Railway storage, delete-account,
      admin MFA si aplica).

## 2. Launch day

1. Backup pre-launch (`backup:prod`).
2. Confirmar `crons.yml` + último deploy Railway healthy.
3. Smoke §1.7 en producción.
4. Sentry dashboard abierto las primeras horas.
5. Cuando haya dominio: DNS → Railway; SPF/DKIM antes de cambiar `from` en
   `src/lib/resend/client.ts`.
6. Publicar landing; anotar timestamp.

## 3. Post-launch (72h)

- [ ] Sentry `is:new` cada 2–4 h.
- [ ] `payment_webhook_events` sin acumulación de no-`processed`.
- [ ] Railway logs: 5xx en `/api/billing/*`, `/api/payments/*`, `/api/cron/*`.
- [ ] Resend bounces/complaints.
- [ ] Crons Actions 200 OK.
- [ ] Backups diarios subiendo al bucket S3-compatible.

## 4. Rollback playbook

### Deploy con bug crítico
1. Railway → Deployments → redeploy / rollback al release healthy previo.
2. Hotfix vía PR normal cuando CI esté verde.

### Deploy no disparó
1. Verificar integración GitHub en Railway.
2. Redeploy manual desde Railway Dashboard o push vacío a `main` si hace falta.

### Schema problemático
1. No rollback destructivo sin backup verificado (<24h).
2. Preferir migrations forward-only (expand/contract).
3. DR completo: `backup-runbook.md` §7.

### Sentry sin eventos
1. Confirmar `Sentry.init` + env vars en Railway.
2. Test envelope directo (ver `sentry-alerts.md`).
3. Revisar CSP `connect-src` en `next.config.ts`.

## 5. Referencias

- `docs/operational/backup-runbook.md`
- `docs/operational/cron-schedules.md`
- `docs/operational/email-domain.md`
- `docs/operational/fel-emission-policy.md`
- `docs/operational/migration-deployment.md`
- `docs/operational/storage-buckets.md`
- `src/lib/observability/sentry-alerts.md`
- `archive/supabase/ARCHIVED.md`

## 6. Última revisión

`2026-07-25 — Railway cutover (Supabase/Vercel removed)`
