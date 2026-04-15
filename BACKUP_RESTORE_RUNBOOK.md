# Runbook local: Backup y Restore (Supabase)

## Objetivo
Ejecutar backup, restore y validación de seguridad en ambiente local (Docker Desktop + Supabase local).

## Requisitos
- `supabase` CLI instalado
- `psql` instalado
- Servicios locales levantados con `supabase start`

## 1) Generar backup
```bash
npm run backup:local
```

Salida:
- `backups/supabase_local_full_YYYYMMDD_HHMMSS.sql`
- `backups/supabase_local_data_YYYYMMDD_HHMMSS.sql`

Notas:
- El script valida que `DB_URL` sea local (`localhost/127.0.0.1`) para evitar uso accidental en entornos remotos.
- Los dumps se generan sobre `schema public` para garantizar restore estable en local.

## 2) Restaurar backup
```bash
npm run restore:local -- ./backups/supabase_local_data_YYYYMMDD_HHMMSS.sql
```

Notas:
- El restore hace `supabase db reset --local --yes` antes de aplicar el dump.
- Usa transacción única con `psql --single-transaction`.
- El restore usa dump data-only para evitar conflictos por objetos de esquema ya creados por migraciones.

## 3) Validar restore
```bash
npm run verify:restore
```

La validación revisa:
- Tablas críticas multi-tenant y de seguridad.
- Tablas de billing/reporting requeridas para smoke (`lifecycle_touchpoints`, `marketing_funnel_events`, `recurrente_checkout_contexts`).
- Columnas de hardening admin (`password_rotated_at`, `must_rotate_password`).
- Policy RLS de lockout por usuario.
- Constraint única anti-replay de webhooks.

## 3.1) Preflight de smoke local
```bash
npm run verify:smoke:local
```

Este preflight falla si:
- faltan llaves de Recurrente en `.env.local` y no activaste `RECURRENTE_MOCK_MODE=true`
- el esquema local no tiene las tablas de billing/reporting necesarias para QA smoke

Setup minimo recomendado para smoke local sin credenciales reales:
```bash
RECURRENTE_MOCK_MODE=true
RECURRENTE_WEBHOOK_SECRET=whsec_local_rutacero_1234567890abcdef
```

## 4) Pruebas mínimas post-restore
```bash
npm run lint
npm run test:run
npm run build
```

Opcional:
```bash
npm run test:e2e:login
```
