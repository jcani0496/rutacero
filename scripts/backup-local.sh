#!/usr/bin/env bash
# Local Postgres backup (docker-compose.db.yml / Railway-local stack).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

DEFAULT_DB_URL="postgresql://rutacero:rutacero@localhost:54329/rutacero"
DB_URL="${DATABASE_URL:-$DEFAULT_DB_URL}"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Error: pg_dump no esta instalado (instala postgresql-client)."
  exit 1
fi

if [[ ! "$DB_URL" =~ @(127\.0\.0\.1|localhost|0\.0\.0\.0)[:/] ]]; then
  echo "Error: este script solo permite backup de Postgres local."
  echo "DATABASE_URL detectado no apunta a localhost."
  exit 1
fi

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
mkdir -p "$BACKUP_DIR"

FULL_BACKUP_FILE="$BACKUP_DIR/local_full_${TIMESTAMP}.sql"
DATA_BACKUP_FILE="$BACKUP_DIR/local_data_${TIMESTAMP}.sql"

echo "Creating local Postgres backups..."
pg_dump "$DB_URL" --no-owner --no-privileges --schema=public --file "$FULL_BACKUP_FILE"
pg_dump "$DB_URL" --no-owner --no-privileges --schema=public --data-only --file "$DATA_BACKUP_FILE"

echo "Backups created:"
echo "- $FULL_BACKUP_FILE"
echo "- $DATA_BACKUP_FILE"
