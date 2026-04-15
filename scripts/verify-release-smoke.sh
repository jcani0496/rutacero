#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="$ROOT_DIR/.env.local"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: supabase CLI no esta instalado."
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql no esta instalado."
  exit 1
fi

has_env_key() {
  local key="$1"

  if [[ -n "${!key:-}" ]]; then
    return 0
  fi

  if [[ -f "$ENV_FILE" ]] && rg -q "^${key}=" "$ENV_FILE"; then
    return 0
  fi

  return 1
}

is_true() {
  local key="$1"
  local value="${!key:-}"

  if [[ "$value" == "true" ]]; then
    return 0
  fi

  if [[ -f "$ENV_FILE" ]] && rg -q "^${key}=true$" "$ENV_FILE"; then
    return 0
  fi

  return 1
}

RECURRENTE_MOCK_MODE_ENABLED=false

if is_true "RECURRENTE_MOCK_MODE"; then
  RECURRENTE_MOCK_MODE_ENABLED=true
fi

if ! has_env_key "NEXT_PUBLIC_SUPABASE_ANON_KEY"; then
  echo "Fallo: NEXT_PUBLIC_SUPABASE_ANON_KEY no esta configurado."
  exit 1
fi

if ! has_env_key "SUPABASE_SERVICE_ROLE_KEY"; then
  echo "Fallo: SUPABASE_SERVICE_ROLE_KEY no esta configurado."
  exit 1
fi

if [[ "$RECURRENTE_MOCK_MODE_ENABLED" != "true" ]] && ! has_env_key "RECURRENTE_PUBLIC_KEY" && ! has_env_key "RECURRENTE_API_KEY"; then
  echo "Fallo: RECURRENTE_PUBLIC_KEY o RECURRENTE_API_KEY no esta configurado."
  exit 1
fi

if [[ "$RECURRENTE_MOCK_MODE_ENABLED" != "true" ]] && ! has_env_key "RECURRENTE_SECRET_KEY"; then
  echo "Fallo: RECURRENTE_SECRET_KEY no esta configurado."
  exit 1
fi

if ! has_env_key "RECURRENTE_WEBHOOK_SECRET"; then
  echo "Fallo: RECURRENTE_WEBHOOK_SECRET no esta configurado."
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
  echo "Error: este script solo permite validacion sobre Supabase local."
  echo "DB_URL detectado: $DB_URL"
  exit 1
fi

declare -a required_tables=(
  "auth_login_lockouts"
  "lifecycle_touchpoints"
  "marketing_funnel_events"
  "payment_webhook_events"
  "recurrente_checkout_contexts"
  "subscriptions"
)

for table in "${required_tables[@]}"; do
  exists="$(psql "$DB_URL" -Atqc "SELECT to_regclass('public.${table}') IS NOT NULL;")"
  if [[ "$exists" != "t" ]]; then
    echo "Fallo: tabla requerida para smoke faltante -> public.${table}"
    exit 1
  fi
done

echo "Smoke local listo para billing/reporting."
if [[ "$RECURRENTE_MOCK_MODE_ENABLED" == "true" ]]; then
  echo "Env de Supabase y Recurrente mock presentes; tablas criticas presentes."
else
  echo "Env de Supabase/Recurrente y tablas criticas presentes."
fi
