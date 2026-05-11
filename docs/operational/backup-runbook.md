# Backup & Restore Runbook — Producción

Operacional. Mantener actualizado. Dueño: founder técnico.

## 1. Propósito, RTO y RPO

Este runbook cubre el respaldo y la restauración de la base de datos
Postgres de Supabase que sustenta Rutacero en producción.

| Objetivo | Valor |
| --- | --- |
| Frecuencia de backup | 1×/día, 02:00 UTC |
| Retención | 30 días (lifecycle del bucket) |
| RTO (Recovery Time Objective) | < 4 horas |
| RPO (Recovery Point Objective) | < 24 horas |
| Verificación de restauración | Mensual (manual o cron) |

Qué se respalda:

- Esquema `public` (datos de aplicación: tenants, debts, subscriptions, etc.).
- Esquema `auth` (usuarios de Supabase Auth).
- Esquema `storage` (metadatos de buckets; los objetos NO — ver §8).

## 2. Infraestructura recomendada

### Backblaze B2 (recomendado, free tier 10 GB)

1. Crear cuenta en <https://www.backblaze.com/cloud-storage>.
2. Crear bucket privado, p. ej. `rutacero-prod-backups`.
3. Sección **Lifecycle Settings** → "Keep only the last version of the file"
   y configurar retención de 30 días vía rule de lifecycle.
4. Sección **Application Keys** → crear una key con scope `READ_WRITE`
   limitada al bucket. Anotar `keyID` y `applicationKey`.
5. El endpoint queda en la forma `https://s3.<region>.backblazeb2.com`,
   por ejemplo `https://s3.us-west-002.backblazeb2.com`.

### Alternativas

- **Cloudflare R2** (S3-compatible, 10 GB free, sin egress fees).
  Cambia solo `BACKUP_S3_ENDPOINT` y la región (`auto`).
- **Wasabi** (paid, sin egress fees) — buena opción si el dataset crece.
- **AWS S3** — funciona, pero el egress se cobra.

### Por qué NO Vercel Blob

Vercel Blob no es S3-compatible (su API es propietaria), no se integra con
las herramientas estándar (`aws`, `s3cmd`, `mc`) y el costo escala con el
egress. Para respaldos de DB queremos un bucket frío, barato y portable.

## 3. Variables de entorno

| Var | Requerida | Descripción | Ejemplo |
| --- | --- | --- | --- |
| `SUPABASE_DB_URL` | Sí | Connection string al pooler de sesión (puerto 5432, NO 6543). | `postgresql://postgres.abc:PWD@aws-0-us-east-1.pooler.supabase.com:5432/postgres` |
| `BACKUP_S3_ENDPOINT` | Sí | URL del endpoint S3-compatible. | `https://s3.us-west-002.backblazeb2.com` |
| `BACKUP_S3_BUCKET` | Sí | Nombre del bucket. | `rutacero-prod-backups` |
| `BACKUP_S3_ACCESS_KEY_ID` | Sí | Access key id. | `00412abc…` |
| `BACKUP_S3_SECRET_ACCESS_KEY` | Sí | Secret. | `K003xyz…` |
| `BACKUP_S3_REGION` | Sí | Región del proveedor. | `us-west-002` |
| `BACKUP_RETENTION_DAYS` | No (def. `30`) | Hint informativo; la retención real es regla de bucket. | `30` |
| `BACKUP_PREFIX` | No (def. `rutacero-prod`) | Prefijo de la key en el bucket. | `rutacero-prod` |

> Importante: usar **session pooler** (puerto 5432). El transaction pooler
> (puerto 6543) no soporta `pg_dump` porque no permite sesiones largas.

## 4. Ejecutar el backup manualmente

```bash
export SUPABASE_DB_URL="postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:5432/postgres"
export BACKUP_S3_ENDPOINT="https://s3.us-west-002.backblazeb2.com"
export BACKUP_S3_BUCKET="rutacero-prod-backups"
export BACKUP_S3_ACCESS_KEY_ID="…"
export BACKUP_S3_SECRET_ACCESS_KEY="…"
export BACKUP_S3_REGION="us-west-002"

npm run backup:prod
```

Salida esperada (última línea, JSON):

```json
{"status":"success","key":"rutacero-prod/2026/05/10/rutacero-prod-20260510-020000.sql.gz","s3_uri":"s3://rutacero-prod-backups/…","bytes":1234567,"duration_s":42,"retention_days":"30"}
```

Si falla, el script emite `{"status":"failure", "reason":"…", "exit_code":N}`
y exit code distinto de cero. Códigos:

| Código | Significado |
| --- | --- |
| `1` | Variables de entorno faltantes |
| `2` | CLI faltante (`pg_dump`, `gzip`, `aws`) |
| `3` | Se rechazó porque la URL apunta a host local |
| `4` | Falla en `pg_dump`/`gzip`/`aws s3 cp` |
| `5` | Verificación post-upload falló |

## 5. Automatización (cron diario)

### Opción A — GitHub Actions (recomendada)

Cuando estén disponibles las credenciales de prod, añadir
`.github/workflows/backup-prod.yml`:

```yaml
name: Backup prod DB

on:
  schedule:
    # 02:00 UTC todos los días
    - cron: '0 2 * * *'
  workflow_dispatch: {}

permissions:
  contents: read

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install postgres client + aws cli
        run: |
          sudo apt-get update
          sudo apt-get install -y postgresql-client awscli gzip
      - name: Run backup
        env:
          SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
          BACKUP_S3_ENDPOINT: ${{ secrets.BACKUP_S3_ENDPOINT }}
          BACKUP_S3_BUCKET: ${{ secrets.BACKUP_S3_BUCKET }}
          BACKUP_S3_ACCESS_KEY_ID: ${{ secrets.BACKUP_S3_ACCESS_KEY_ID }}
          BACKUP_S3_SECRET_ACCESS_KEY: ${{ secrets.BACKUP_S3_SECRET_ACCESS_KEY }}
          BACKUP_S3_REGION: ${{ secrets.BACKUP_S3_REGION }}
        run: npm run backup:prod
```

> El workflow **no se commitea ahora**. Crear cuando estén los secrets en
> GitHub. Anotar en project tracker como follow-up de prod-launch.

### Opción B — Cron en VM

```cron
0 2 * * *  /opt/rutacero/run-backup.sh >> /var/log/rutacero-backup.log 2>&1
```

Donde `run-backup.sh` carga `/etc/rutacero/backup.env` con las 6 variables
y luego invoca `npm run backup:prod` desde el checkout del repo.

## 6. Verificación periódica (mensual)

Objetivo: asegurar que los backups NO solo se suben, sino que **se pueden
restaurar** y la integridad de schema es correcta.

Pasos:

1. **Crear staging branch en Supabase.** Dashboard → Branches → New branch
   (basado en `main`). Esto produce una DB efímera con su propio URL.
2. **Recuperar la URL de conexión** de la branch (panel → Database →
   Connection string → Session pooler).
3. **Identificar el backup más reciente** en el bucket:
   ```bash
   aws s3 ls s3://rutacero-prod-backups/rutacero-prod/ \
     --recursive --endpoint-url "$BACKUP_S3_ENDPOINT" \
     | sort | tail -n1
   ```
4. **Ejecutar verificación:**
   ```bash
   export STAGING_DB_URL="postgresql://postgres.<branch-ref>:<pwd>@…:5432/postgres"
   export LATEST_BACKUP_S3_URI="s3://rutacero-prod-backups/…/rutacero-prod-YYYYMMDD-HHMMSS.sql.gz"
   export BACKUP_S3_ENDPOINT="…"
   export BACKUP_S3_ACCESS_KEY_ID="…"
   export BACKUP_S3_SECRET_ACCESS_KEY="…"
   export BACKUP_S3_REGION="…"
   export PROD_DB_HOST_BLOCKLIST="aws-0-us-east-1.pooler.supabase.com,prod.rutacero"

   npm run verify:restore:staging
   ```
5. **Resultado esperado:** JSON con `"status":"success"` y conteos de
   tenants/debts > 0.
6. **Limpieza:** Dashboard → Branches → drop branch.

> La branch debe estar limpia (sin tablas en `public`) antes de correr el
> restore. El script **no** hace reset (es destructivo) — esa parte queda
> manual hasta que se construya un workflow dedicado.

## 7. Disaster Recovery (DR) playbook

Activar este playbook si la DB de producción se corrompe, se borra, o
Supabase declara incidente irrecuperable.

1. **Identificar el incidente** y declarar war-room. Bloquear escrituras
   externas si es posible (pausar webhooks, mostrar página de mantenimiento).
2. **Localizar el último backup verificado.** Mirar el log del cron de
   backup; el último JSON `"status":"success"` antes del incidente es el
   target.
3. **Provisionar destino:**
   - Opción A — restaurar **in-place** sobre el proyecto Supabase actual
     (requiere reset del esquema `public`).
   - Opción B — crear un proyecto Supabase nuevo y mover los DNS/secrets.
4. **Descargar y restaurar:**
   ```bash
   aws s3 cp s3://rutacero-prod-backups/<key> ./restore.sql.gz \
     --endpoint-url "$BACKUP_S3_ENDPOINT"
   gunzip restore.sql.gz
   psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f restore.sql
   ```
5. **Actualizar credenciales** en Vercel (project → Settings → Environment
   Variables): `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `DATABASE_URL`. Re-deploy.
6. **Smoke test:** login con cuenta de prueba, crear una deuda, abrir
   dashboard, ver que `/finances` carga datos restaurados. Ejecutar
   `npm run verify:smoke:local` apuntando a prod si la herramienta lo permite.
7. **Post-mortem:** documentar timeline, RTO/RPO reales, gaps detectados,
   acciones correctivas. Subir a `docs/operational/incidents/YYYY-MM-DD-…`.

## 8. Limitaciones conocidas

- **Supabase Storage (objetos en buckets) NO se respalda.** El dump
  incluye los metadatos del esquema `storage` (tablas `buckets`, `objects`)
  pero no los binarios. Cuando exista el bucket `payment-receipts`,
  añadir un job complementario que use `supabase storage download` o
  el SDK para sincronizarlo a S3. Tracked como follow-up.
- **Secrets de Vercel / Resend / Recurrente no se respaldan.** Mantener
  un vault separado (1Password, Bitwarden) con la lista canónica.
- **El dump incluye los schemas `auth` y `storage`**, así que metadata de
  `auth.users` (incl. emails, password hashes) sí se preserva. Sensibilidad
  alta — el bucket DEBE ser privado y la application key con scope mínimo.
- **No se hacen PITR (point-in-time-recovery).** Si se requiere granularidad
  por debajo de 24h, habilitar PITR nativo de Supabase (plan Pro+).
- **No hay encriptación at-rest adicional al lado del cliente.** El upload
  se cifra in-transit (TLS) y B2/R2 cifran at-rest server-side. Si se
  requiere encriptación con clave del cliente, añadir `gpg --symmetric`
  entre `gzip` y `aws s3 cp` en `scripts/backup-prod.sh`.

## 9. Última revisión

- Fecha: 2026-05-10
- Owner: jcani0496@gmail.com
- Próxima revisión obligatoria: 2026-08-10 (trimestral) o después del
  primer DR drill, lo que ocurra primero.
