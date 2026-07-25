#!/usr/bin/env bash
# Local smoke preflight for Railway Postgres + better-auth + billing env.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="$ROOT_DIR/.env.local"
DEFAULT_DB_URL="postgresql://rutacero:rutacero@localhost:54329/rutacero"
DB_URL="${DATABASE_URL:-$DEFAULT_DB_URL}"

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

if ! has_env_key "DATABASE_URL" && [[ ! -f "$ENV_FILE" ]]; then
  echo "Aviso: DATABASE_URL no definido; usando default local ${DEFAULT_DB_URL}"
fi

if ! has_env_key "BETTER_AUTH_SECRET"; then
  echo "Fallo: BETTER_AUTH_SECRET no esta configurado."
  exit 1
fi

if ! has_env_key "ADMIN_JWT_SECRET"; then
  echo "Fallo: ADMIN_JWT_SECRET no esta configurado."
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

if [[ ! "$DB_URL" =~ @(127\.0\.0\.1|localhost|0\.0\.0\.0)[:/] ]]; then
  echo "Error: este script solo permite validacion sobre Postgres local."
  echo "DATABASE_URL detectado no apunta a localhost."
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
  echo "Env Railway/better-auth y Recurrente mock presentes; tablas criticas presentes."
else
  echo "Env Railway/better-auth/Recurrente y tablas criticas presentes."
fi
