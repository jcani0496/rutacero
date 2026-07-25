#!/usr/bin/env bash
# Restore a data-only dump into local Postgres (docker-compose.db.yml).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_FILE="${1:-}"
DEFAULT_DB_URL="postgresql://rutacero:rutacero@localhost:54329/rutacero"
DB_URL="${DATABASE_URL:-$DEFAULT_DB_URL}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Uso: bash scripts/restore-local.sh <ruta_al_backup.sql>"
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Error: archivo no encontrado: $BACKUP_FILE"
  exit 1
fi

if [[ "$BACKUP_FILE" != *"_data_"* ]]; then
  echo "Error: para restore local debes usar un backup data-only (_data_)."
  echo "Ejemplo: npm run restore:local -- ./backups/local_data_YYYYMMDD_HHMMSS.sql"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql no esta instalado."
  exit 1
fi

if [[ ! "$DB_URL" =~ @(127\.0\.0\.1|localhost|0\.0\.0\.0)[:/] ]]; then
  echo "Error: este script solo permite restore sobre Postgres local."
  echo "DATABASE_URL detectado no apunta a localhost."
  exit 1
fi

echo "Reiniciando schema local (docker compose + drizzle push)..."
npm run db:reset:local

echo "Limpiando datos actuales del schema public..."
psql "$DB_URL" --set=ON_ERROR_STOP=on <<'SQL' >/dev/null
DO $$
DECLARE
  truncate_sql text;
BEGIN
  SELECT
    'TRUNCATE TABLE ' ||
    string_agg(format('%I.%I', schemaname, tablename), ', ') ||
    ' RESTART IDENTITY CASCADE'
  INTO truncate_sql
  FROM pg_tables
  WHERE schemaname = 'public';

  IF truncate_sql IS NOT NULL THEN
    EXECUTE truncate_sql;
  END IF;
END $$;
SQL

echo "Restaurando backup data-only: $BACKUP_FILE"
psql "$DB_URL" --set=ON_ERROR_STOP=on --single-transaction --file "$BACKUP_FILE" >/dev/null

echo "Restore completado."
echo "Siguiente paso recomendado: npm run verify:restore"
