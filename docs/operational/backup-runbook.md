# Backup & Restore Runbook — Producción

Operacional. Mantener actualizado. Dueño: founder técnico.

## 1. Propósito, RTO y RPO

Este runbook cubre el respaldo y la restauración de la base de datos
**Railway Postgres** que sustenta Rutacero en producción.

| Objetivo | Valor |
| --- | --- |
| Frecuencia de backup | 1×/día, 02:00 UTC |
| Retención | 30 días (lifecycle del bucket) |
| RTO (Recovery Time Objective) | < 4 horas |
| RPO (Recovery Point Objective) | < 24 horas |
| Verificación de restauración | Mensual (manual o cron) |

Qué se respalda:

- Esquema `public` (datos de aplicación: tenants, debts, subscriptions,
  better-auth tables, etc.).

Qué **no** se respalda aquí:

- Objetos binarios del bucket Railway `payment-receipts` (ver §8).
- Secrets de Railway / Resend / Recurrente (vault separado).

## 2. Infraestructura recomendada

### Backblaze B2 (recomendado, free tier 10 GB)

1. Crear cuenta en <https://www.backblaze.com/cloud-storage>.
2. Crear bucket privado, p. ej. `rutacero-prod-backups`.
3. Sección **Lifecycle Settings** → retención ~30 días.
4. Sección **Application Keys** → key `READ_WRITE` limitada al bucket.
5. Endpoint tipo `https://s3.<region>.backblazeb2.com`.

### Alternativas

- **Cloudflare R2**, **Wasabi**, **AWS S3** — S3-compatible.

### Nota sobre hosting de backups

Usar un bucket S3-compatible frío/portable (`aws` CLI). No usar APIs
propietarias de object storage del host de la app.

## 3. Variables de entorno

| Var | Requerida | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | Sí | Connection string de Railway Postgres (prod). |
| `BACKUP_S3_ENDPOINT` | Sí | URL del endpoint S3-compatible. |
| `BACKUP_S3_BUCKET` | Sí | Nombre del bucket. |
| `BACKUP_S3_ACCESS_KEY_ID` | Sí | Access key id. |
| `BACKUP_S3_SECRET_ACCESS_KEY` | Sí | Secret. |
| `BACKUP_S3_REGION` | Sí | Región del proveedor. |
| `BACKUP_RETENTION_DAYS` | No (def. `30`) | Hint informativo. |
| `BACKUP_PREFIX` | No (def. `rutacero-prod`) | Prefijo de la key. |

## 4. Ejecutar el backup manualmente

```bash
export DATABASE_URL="<railway-postgres-url>"
export BACKUP_S3_ENDPOINT="https://s3.us-west-002.backblazeb2.com"
export BACKUP_S3_BUCKET="rutacero-prod-backups"
export BACKUP_S3_ACCESS_KEY_ID="…"
export BACKUP_S3_SECRET_ACCESS_KEY="…"
export BACKUP_S3_REGION="us-west-002"

npm run backup:prod
```

Salida esperada (última línea, JSON):

```json
{"status":"success","key":"rutacero-prod/…/rutacero-prod-….sql.gz","s3_uri":"s3://…","bytes":1234567,"duration_s":42,"retention_days":"30"}
```

Códigos de salida: `1` env faltante, `2` CLI faltante, `3` URL local
rechazada, `4` pipeline dump/upload, `5` verificación post-upload.

## 5. Automatización (cron diario)

### Opción A — GitHub Actions (recomendada)

Cuando estén los secrets, añadir `.github/workflows/backup-prod.yml` con
`DATABASE_URL` (y `BACKUP_S3_*`) desde GitHub Secrets, invocando
`npm run backup:prod`.

### Opción B — Cron en VM

Cargar env y ejecutar `npm run backup:prod` a las 02:00 UTC.

## 6. Verificación periódica (mensual)

1. Provisionar una DB staging (Railway Postgres efímero / servicio staging).
2. Identificar el backup más reciente en el bucket S3.
3. Ejecutar:
   ```bash
   export STAGING_DB_URL="postgresql://…"
   export LATEST_BACKUP_S3_URI="s3://…"
   export BACKUP_S3_ENDPOINT="…"
   export BACKUP_S3_ACCESS_KEY_ID="…"
   export BACKUP_S3_SECRET_ACCESS_KEY="…"
   export BACKUP_S3_REGION="…"
   export PROD_DB_HOST_BLOCKLIST="railway,prod.rutacero"

   npm run verify:restore:staging
   ```
4. Esperar JSON `"status":"success"`.
5. Destruir la DB staging.

## 7. Disaster Recovery (DR) playbook

1. Declarar incidente; pausar escrituras externas si es posible.
2. Localizar el último backup con `"status":"success"`.
3. Provisionar destino (restaurar in-place sobre Railway Postgres o servicio nuevo).
4. Descargar y restaurar con `psql` / `gunzip`.
5. Actualizar `DATABASE_URL` (y providers) en Railway → redeploy web.
6. Smoke: login, crear deuda, dashboard, finances.
7. Post-mortem en `docs/operational/incidents/`.

## 8. Limitaciones conocidas

- **Railway Bucket objects NO se respaldan** con este dump. Añadir job
  complementario S3 sync para `payment-receipts` si se necesita.
- **Secrets no se respaldan** — vault separado (1Password / Bitwarden).
- **Sin PITR** por defecto; evaluar backups más frecuentes o PITR del
  proveedor si RPO < 24h deja de ser aceptable.

## 9. Última revisión

- Fecha: 2026-07-25
- Owner: jcani0496@gmail.com
- Stack: Railway Postgres (Supabase/Vercel retirados)
