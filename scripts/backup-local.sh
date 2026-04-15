#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: supabase CLI no esta instalado."
  exit 1
fi

STATUS_ENV="$(supabase status -o env)"
DB_URL="$(printf '%s\n' "$STATUS_ENV" | sed -n 's/^DB_URL=//p' | head -n1 | tr -d '"')"

if [[ -z "${DB_URL:-}" ]]; then
  echo "Error: no se pudo obtener DB_URL desde 'supabase status -o env'."
  echo "Asegurate de ejecutar 'supabase start' primero."
  exit 1
fi

if [[ ! "$DB_URL" =~ @(127\.0\.0\.1|localhost|0\.0\.0\.0): ]]; then
  echo "Error: este script solo permite backup de Supabase local."
  echo "DB_URL detectado: $DB_URL"
  exit 1
fi

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
mkdir -p "$BACKUP_DIR"

FULL_BACKUP_FILE="$BACKUP_DIR/supabase_local_full_${TIMESTAMP}.sql"
DATA_BACKUP_FILE="$BACKUP_DIR/supabase_local_data_${TIMESTAMP}.sql"

echo "Creating local Supabase backups..."
# Keep backups restorable with standard local role (`postgres`).
# `auth/storage` schema objects may require elevated ownership and can fail on restore.
supabase db dump --local --schema public --file "$FULL_BACKUP_FILE"
supabase db dump --local --data-only --schema public --file "$DATA_BACKUP_FILE"

echo "Backups created:"
echo "- $FULL_BACKUP_FILE"
echo "- $DATA_BACKUP_FILE"
