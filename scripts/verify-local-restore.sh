#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: supabase CLI no esta instalado."
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql no esta instalado."
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
  exists="$(psql "$DB_URL" -Atqc "SELECT to_regclass('public.${table}') IS NOT NULL;")"
  if [[ "$exists" != "t" ]]; then
    echo "Fallo: tabla requerida faltante -> public.${table}"
    exit 1
  fi
done

rotation_column="$(psql "$DB_URL" -Atqc "SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='admin_users'
    AND column_name='password_rotated_at'
);")"

must_rotate_column="$(psql "$DB_URL" -Atqc "SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='admin_users'
    AND column_name='must_rotate_password'
);")"

if [[ "$rotation_column" != "t" || "$must_rotate_column" != "t" ]]; then
  echo "Fallo: columnas de rotacion de password admin no existen."
  exit 1
fi

lockout_policy="$(psql "$DB_URL" -Atqc "SELECT EXISTS (
  SELECT 1
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename='auth_login_lockouts'
    AND policyname='authenticated user can read own lockout row'
);")"

if [[ "$lockout_policy" != "t" ]]; then
  echo "Fallo: policy de lockout por usuario no encontrada."
  exit 1
fi

webhook_unique="$(psql "$DB_URL" -Atqc "SELECT EXISTS (
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
  echo "Fallo: constraint unique de webhook replay no encontrada."
  exit 1
fi

subscription_marketing_columns="$(psql "$DB_URL" -Atqc "SELECT EXISTS (
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
  echo "Fallo: columnas de attribution/marketing_context en subscriptions no existen."
  exit 1
fi

echo "Restore validado correctamente."
echo "Tablas y controles de seguridad/billing/reporting presentes."
