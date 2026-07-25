#!/usr/bin/env bash
#
# backup-prod.sh — Production backup script for Railway Postgres.
#
# Streams a gzipped pg_dump of the production database to an S3-compatible
# bucket (Backblaze B2, Cloudflare R2, AWS S3, MinIO, etc.) using the AWS CLI.
#
# Configuration is entirely via environment variables — never hard-code
# credentials. See docs/operational/backup-runbook.md for the full list.
#
# Exit codes:
#   0   success
#   1   missing/invalid configuration
#   2   missing required CLI dependency
#   3   refusal (DB URL points at a local/dev host)
#   4   pg_dump or upload failure
#   5   post-upload verification failure
#
set -euo pipefail

SCRIPT_NAME="backup-prod.sh"
START_TS="$(date -u +%s)"

log() {
  printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
}

fail() {
  local code="$1"
  shift
  log "ERROR: $*"
  printf '{"status":"failure","reason":%s,"exit_code":%d}\n' \
    "$(printf '%s' "$*" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))' 2>/dev/null \
       || printf '"%s"' "$*")" "$code"
  exit "$code"
}

trap 'rc=$?; if [[ $rc -ne 0 ]]; then log "Script $SCRIPT_NAME aborted with exit code $rc"; fi' EXIT

# ---------------------------------------------------------------------------
# 1. Validate required environment variables
# ---------------------------------------------------------------------------
required_vars=(
  DATABASE_URL
  BACKUP_S3_ENDPOINT
  BACKUP_S3_BUCKET
  BACKUP_S3_ACCESS_KEY_ID
  BACKUP_S3_SECRET_ACCESS_KEY
  BACKUP_S3_REGION
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

BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BACKUP_PREFIX="${BACKUP_PREFIX:-rutacero-prod}"

# ---------------------------------------------------------------------------
# 2. Validate required CLIs
# ---------------------------------------------------------------------------
if ! command -v pg_dump >/dev/null 2>&1; then
  fail 2 "pg_dump no esta instalado (instala postgresql-client)."
fi

if ! command -v gzip >/dev/null 2>&1; then
  fail 2 "gzip no esta instalado."
fi

UPLOADER=""
if command -v aws >/dev/null 2>&1; then
  UPLOADER="aws"
elif command -v s3cmd >/dev/null 2>&1; then
  UPLOADER="s3cmd"
elif command -v mc >/dev/null 2>&1; then
  UPLOADER="mc"
else
  fail 2 "Necesitas al menos uno de: aws CLI, s3cmd, mc (MinIO client)."
fi

# We only implement the aws CLI path because it is the most portable for
# arbitrary S3-compatible endpoints. Fail loudly if aws is not present.
if [[ "$UPLOADER" != "aws" ]]; then
  fail 2 "Este script usa 'aws' CLI (detectado: $UPLOADER). Instala aws-cli."
fi

log "Uploader seleccionado: $UPLOADER"

# ---------------------------------------------------------------------------
# 3. Refuse to run against local/dev hosts
# ---------------------------------------------------------------------------
if [[ "$DATABASE_URL" =~ @(127\.0\.0\.1|localhost|0\.0\.0\.0)[:/] ]]; then
  fail 3 "DATABASE_URL apunta a un host local. Este script es solo para prod."
fi

# ---------------------------------------------------------------------------
# 4. Build the destination key
# ---------------------------------------------------------------------------
DATE_PATH="$(date -u +%Y/%m/%d)"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
KEY="${BACKUP_PREFIX}/${DATE_PATH}/rutacero-prod-${STAMP}.sql.gz"
S3_URI="s3://${BACKUP_S3_BUCKET}/${KEY}"

log "Destino: $S3_URI"
log "Retencion configurada (hint para lifecycle rule): ${BACKUP_RETENTION_DAYS} dias"

# ---------------------------------------------------------------------------
# 5. Export AWS env so the aws CLI picks up our credentials/endpoint
# ---------------------------------------------------------------------------
export AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="$BACKUP_S3_REGION"
# Some S3-compatible providers (Backblaze B2) want path-style addressing.
export AWS_S3_ADDRESSING_STYLE="${AWS_S3_ADDRESSING_STYLE:-path}"

# ---------------------------------------------------------------------------
# 6. Stream pg_dump -> gzip -> aws s3 cp (no temp file on disk)
# ---------------------------------------------------------------------------
log "Iniciando pg_dump (schema: public)..."

# `set -o pipefail` (already enabled via set -e + pipefail substitute) ensures
# we catch failures in any stage of the pipeline. We rely on bash's pipefail.
set -o pipefail

if ! pg_dump "$DATABASE_URL" \
      --no-owner \
      --no-privileges \
      --schema=public \
   | gzip -9 \
   | aws s3 cp - "$S3_URI" \
       --endpoint-url "$BACKUP_S3_ENDPOINT" \
       --expected-size 0 \
       --no-progress
then
  fail 4 "pg_dump|gzip|aws s3 cp pipeline fallo."
fi

log "Upload completado. Verificando objeto en bucket..."

# ---------------------------------------------------------------------------
# 7. Post-upload verification
# ---------------------------------------------------------------------------
LS_OUTPUT="$(aws s3 ls "$S3_URI" --endpoint-url "$BACKUP_S3_ENDPOINT" 2>/dev/null || true)"
if [[ -z "$LS_OUTPUT" ]]; then
  fail 5 "Objeto no encontrado tras upload: $S3_URI"
fi

# `aws s3 ls` output: "YYYY-MM-DD HH:MM:SS  <size>  <key>"
BYTES="$(printf '%s\n' "$LS_OUTPUT" | awk '{print $3}' | head -n1)"
if [[ -z "$BYTES" || "$BYTES" == "0" ]]; then
  fail 5 "Backup subido pero tamano es 0 bytes."
fi

END_TS="$(date -u +%s)"
DURATION=$(( END_TS - START_TS ))

log "Backup OK: $S3_URI ($BYTES bytes, ${DURATION}s)"

# JSON summary on stdout for cron / log aggregators.
printf '{"status":"success","key":"%s","s3_uri":"%s","bytes":%s,"duration_s":%d,"retention_days":%s}\n' \
  "$KEY" "$S3_URI" "$BYTES" "$DURATION" "$BACKUP_RETENTION_DAYS"
