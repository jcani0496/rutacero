# Runbook local: Backup y Restore (Postgres)

## Objetivo
Ejecutar backup, restore y validación en ambiente local (Docker Postgres via
`docker-compose.db.yml` + Drizzle).

## Requisitos
- Docker Desktop
- `psql` / `pg_dump` instalados
- Postgres local: `npm run db:up:local`

## 1) Generar backup
```bash
npm run backup:local
```

Salida:
- `backups/local_full_YYYYMMDD_HHMMSS.sql`
- `backups/local_data_YYYYMMDD_HHMMSS.sql`

Notas:
- El script valida que `DATABASE_URL` sea local (`localhost` / `127.0.0.1`).
- Los dumps se generan sobre `schema public`.

## 2) Restaurar backup
```bash
npm run restore:local -- ./backups/local_data_YYYYMMDD_HHMMSS.sql
```

Notas:
- El restore corre `npm run db:reset:local` antes de aplicar el dump.
- Usa transacción única con `psql --single-transaction`.
- Usa dump data-only para evitar conflictos con el schema creado por Drizzle.

## 3) Validar restore
```bash
npm run verify:restore
```

La validación revisa:
- Tablas críticas multi-tenant y de seguridad.
- Tablas de billing/reporting requeridas para smoke.
- Columnas de hardening admin.
- Constraint única anti-replay de webhooks.

## 3.1) Preflight de smoke local
```bash
npm run verify:smoke:local
```

Este preflight falla si:
- faltan `BETTER_AUTH_SECRET` / `ADMIN_JWT_SECRET`
- faltan llaves de Recurrente y no activaste `RECURRENTE_MOCK_MODE=true`
- el esquema local no tiene las tablas de billing/reporting necesarias

Setup minimo recomendado para smoke local sin credenciales reales:
```bash
RECURRENTE_MOCK_MODE=true
RECURRENTE_WEBHOOK_SECRET=whsec_local_rutacero_1234567890abcdef
```

## Producción

Ver `docs/operational/backup-runbook.md` (`DATABASE_URL` + bucket S3-compatible).
SQL histórico de Supabase (solo referencia): `archive/supabase/`.
