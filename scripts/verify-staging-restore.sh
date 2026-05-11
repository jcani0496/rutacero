#!/usr/bin/env bash
#
# verify-staging-restore.sh — Monthly restore-verification job.
#
# Pulls the latest production backup from S3, restores it into a Supabase
# *staging* database (a Supabase branch DB or a separate staging project),
# and runs the same integrity checks as verify-local-restore.sh.
#
# This script DOES NOT reset/drop the staging DB — the caller (human or
# workflow) is responsible for providing a clean target. We refuse to run
# against any host listed in PROD_DB_HOST_BLOCKLIST.
#
# Required env vars:
#   STAGING_DB_URL           — psql connection string to the staging DB.
#   LATEST_BACKUP_S3_URI     — s3://bucket/key/of-the-dump.sql.gz
#   BACKUP_S3_ENDPOINT       — S3-compatible endpoint URL.
#   BACKUP_S3_ACCESS_KEY_ID  — access key id.
#   BACKUP_S3_SECRET_ACCESS_KEY — secret access key.
#   BACKUP_S3_REGION         — region string.
#   PROD_DB_HOST_BLOCKLIST   — comma-separated list of host substrings that
#                              indicate a production DB; the script refuses
#                              to run if the staging URL matches any.
#
set -euo pipefail

SCRIPT_NAME="verify-staging-restore.sh"
START_TS="$(date -u +%s)"
TMP_FILE=""

log() {
  printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
}

cleanup() {
  if [[ -n "$TMP_FILE" && -f "$TMP_FILE" ]]; then
    rm -f "$TMP_FILE" "${TMP_FILE%.gz}" || true
    log "Temp files limpiados."
  fi
}

fail() {
  local code="$1"
  shift
  log "ERROR: $*"
  printf '{"status":"failure","reason":"%s","exit_code":%d}\n' "$*" "$code"
  cleanup
  exit "$code"
}

trap 'cleanup' EXIT

# ---------------------------------------------------------------------------
# 1. Validate required env vars
# ---------------------------------------------------------------------------
required_vars=(
  STAGING_DB_URL
  LATEST_BACKUP_S3_URI
  BACKUP_S3_ENDPOINT
  BACKUP_S3_ACCESS_KEY_ID
  BACKUP_S3_SECRET_ACCESS_KEY
  BACKUP_S3_REGION
  PROD_DB_HOST_BLOCKLIST
)

missing=()
for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    missing+=("$var")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  fail 1 "Missing required env vars: ${missing[*]}"
fi

# ---------------------------------------------------------------------------
# 2. Validate required CLIs
# ---------------------------------------------------------------------------
for bin in psql aws gunzip; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    fail 2 "$bin no esta instalado."
  fi
done

# ---------------------------------------------------------------------------
# 3. Refuse to run against prod hosts
# ---------------------------------------------------------------------------
IFS=',' read -r -a blocked_hosts <<< "$PROD_DB_HOST_BLOCKLIST"
for host in "${blocked_hosts[@]}"; do
  host_trimmed="$(printf '%s' "$host" | tr -d '[:space:]')"
  if [[ -z "$host_trimmed" ]]; then continue; fi
  if [[ "$STAGING_DB_URL" == *"$host_trimmed"* ]]; then
    fail 3 "STAGING_DB_URL contiene host bloqueado '$host_trimmed'. Refusing to run."
  fi
done

# Also refuse the obvious local-loopback case — restore here is meaningless.
if [[ "$STAGING_DB_URL" =~ @(127\.0\.0\.1|localhost|0\.0\.0\.0)[:/] ]]; then
  log "WARN: STAGING_DB_URL apunta a localhost; continuando (es valido para una staging local en CI)."
fi

# ---------------------------------------------------------------------------
# 4. Export AWS env for the aws CLI
# ---------------------------------------------------------------------------
export AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="$BACKUP_S3_REGION"
export AWS_S3_ADDRESSING_STYLE="${AWS_S3_ADDRESSING_STYLE:-path}"

# ---------------------------------------------------------------------------
# 5. Download the backup
# ---------------------------------------------------------------------------
WORK_DIR="$(mktemp -d -t rutacero-restore-XXXXXX)"
TMP_FILE="$WORK_DIR/backup.sql.gz"

log "Descargando $LATEST_BACKUP_S3_URI -> $TMP_FILE"
if ! aws s3 cp "$LATEST_BACKUP_S3_URI" "$TMP_FILE" \
      --endpoint-url "$BACKUP_S3_ENDPOINT" \
      --no-progress
then
  fail 4 "Fallo descargando backup desde S3."
fi

if [[ ! -s "$TMP_FILE" ]]; then
  fail 4 "Backup descargado esta vacio."
fi

# ---------------------------------------------------------------------------
# 6. Decompress
# ---------------------------------------------------------------------------
log "Descomprimiendo..."
if ! gunzip -k "$TMP_FILE"; then
  fail 4 "gunzip fallo."
fi
SQL_FILE="${TMP_FILE%.gz}"

if [[ ! -s "$SQL_FILE" ]]; then
  fail 4 "Archivo SQL descomprimido esta vacio."
fi

# ---------------------------------------------------------------------------
# 7. Restore into staging (caller must have reset the DB beforehand)
# ---------------------------------------------------------------------------
log "Restaurando a STAGING_DB_URL via psql..."
if ! psql "$STAGING_DB_URL" \
      -v ON_ERROR_STOP=1 \
      --single-transaction \
      -f "$SQL_FILE" >/dev/null
then
  fail 5 "psql restore fallo. La DB de staging debe estar limpia antes de correr este script."
fi

# ---------------------------------------------------------------------------
# 8. Integrity checks (mirror verify-local-restore.sh)
# ---------------------------------------------------------------------------
declare -a required_tables=(
  "tenants"
  "tenant_memberships"
  "user_profiles"
  "debts"
  "subscriptions"
  "payment_webhook_events"
  "auth_login_lockouts"
  "admin_users"
  "lifecycle_touchpoints"
  "marketing_funnel_events"
  "recurrente_checkout_contexts"
)

for table in "${required_tables[@]}"; do
  exists="$(psql "$STAGING_DB_URL" -Atqc "SELECT to_regclass('public.${table}') IS NOT NULL;")"
  if [[ "$exists" != "t" ]]; then
    fail 6 "Tabla requerida faltante -> public.${table}"
  fi
done

rotation_column="$(psql "$STAGING_DB_URL" -Atqc "SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='admin_users'
    AND column_name='password_rotated_at'
);")"

must_rotate_column="$(psql "$STAGING_DB_URL" -Atqc "SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='admin_users'
    AND column_name='must_rotate_password'
);")"

if [[ "$rotation_column" != "t" || "$must_rotate_column" != "t" ]]; then
  fail 6 "Columnas de rotacion de password admin no existen."
fi

lockout_policy="$(psql "$STAGING_DB_URL" -Atqc "SELECT EXISTS (
  SELECT 1
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename='auth_login_lockouts'
    AND policyname='authenticated user can read own lockout row'
);")"

if [[ "$lockout_policy" != "t" ]]; then
  fail 6 "Policy de lockout por usuario no encontrada."
fi

webhook_unique="$(psql "$STAGING_DB_URL" -Atqc "SELECT EXISTS (
  SELECT 1
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE c.contype = 'u'
    AND n.nspname = 'public'
    AND t.relname = 'payment_webhook_events'
    AND c.conname = 'payment_webhook_events_provider_external_event_id_key'
);")"

if [[ "$webhook_unique" != "t" ]]; then
  fail 6 "Constraint unique de webhook replay no encontrada."
fi

subscription_marketing_columns="$(psql "$STAGING_DB_URL" -Atqc "SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='subscriptions'
    AND column_name='attribution_id'
) AND EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='subscriptions'
    AND column_name='marketing_context'
);")"

if [[ "$subscription_marketing_columns" != "t" ]]; then
  fail 6 "Columnas de attribution/marketing_context en subscriptions no existen."
fi

# ---------------------------------------------------------------------------
# 9. Smoke row counts (informational)
# ---------------------------------------------------------------------------
TENANT_COUNT="$(psql "$STAGING_DB_URL" -Atqc 'SELECT COUNT(*) FROM public.tenants;' || echo "0")"
DEBT_COUNT="$(psql "$STAGING_DB_URL" -Atqc 'SELECT COUNT(*) FROM public.debts;' || echo "0")"

END_TS="$(date -u +%s)"
DURATION=$(( END_TS - START_TS ))

log "Restore validado correctamente."
log "Tenants restaurados: $TENANT_COUNT | Debts restauradas: $DEBT_COUNT"

printf '{"status":"success","source":"%s","tenants":%s,"debts":%s,"duration_s":%d}\n' \
  "$LATEST_BACKUP_S3_URI" "$TENANT_COUNT" "$DEBT_COUNT" "$DURATION"
