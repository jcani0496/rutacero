#!/bin/bash

set -euo pipefail

APP_ID="com.rutacero.app"
MAIN_ACTIVITY=".MainActivity"
DEFAULT_LOCAL_SERVER_HOST="127.0.0.1"
DEFAULT_LOCAL_SERVER_URL="http://${DEFAULT_LOCAL_SERVER_HOST}:3000"
DEFAULT_EMULATOR_HOST="10.0.2.2"

parse_url() {
  local url="$1"

  if [[ "${url}" =~ ^([a-zA-Z][a-zA-Z0-9+.-]*)://([^/:]+)(:([0-9]+))?(/.*)?$ ]]; then
    URL_SCHEME="${BASH_REMATCH[1]}"
    URL_HOST="${BASH_REMATCH[2]}"
    URL_PORT="${BASH_REMATCH[4]}"

    if [ -z "${URL_PORT}" ]; then
      case "${URL_SCHEME}" in
        http) URL_PORT="80" ;;
        https) URL_PORT="443" ;;
        *) return 1 ;;
      esac
    fi

    return 0
  fi

  return 1
}

url_responds() {
  curl -fsSL --max-time 2 "$1" >/dev/null 2>&1
}

is_next_app_url() {
  local body

  body="$(curl -fsSL --max-time 2 "$1" 2>/dev/null || true)"
  [ -n "${body}" ] && printf '%s' "${body}" | grep -Eq '(_next/|__next|self\.__next_f)'
}

is_localhost_host() {
  case "$1" in
    localhost|127.0.0.1|0.0.0.0) return 0 ;;
    *) return 1 ;;
  esac
}

derive_emulator_url() {
  local local_server_url="$1"
  local emulator_host

  parse_url "${local_server_url}" || return 1
  emulator_host="${URL_HOST}"

  if is_localhost_host "${URL_HOST}"; then
    emulator_host="${DEFAULT_EMULATOR_HOST}"
  fi

  printf '%s://%s:%s\n' "${URL_SCHEME}" "${emulator_host}" "${URL_PORT}"
}

list_workspace_next_dev_ports() {
  local repo_cwd pid port command cwd candidate_url

  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi

  repo_cwd="$(pwd -P)"

  while read -r pid port; do
    [ -n "${pid}" ] || continue
    [ -n "${port}" ] || continue

    command="$(ps -p "${pid}" -o command= 2>/dev/null || true)"
    case "${command}" in
      *"next dev"*) ;;
      *) continue ;;
    esac

    cwd="$(lsof -a -p "${pid}" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1)"
    [ "${cwd}" = "${repo_cwd}" ] || continue

    candidate_url="http://${DEFAULT_LOCAL_SERVER_HOST}:${port}"
    if is_next_app_url "${candidate_url}"; then
      printf '%s\n' "${port}"
    fi
  done < <(
    lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null \
      | awk 'NR > 1 { split($9, address, ":"); port=address[length(address)]; if (port ~ /^[0-9]+$/ && port >= 3000 && port < 4000) print $2, port }' \
      | awk '!seen[$1 ":" $2]++'
  )
}

list_candidate_ports() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null \
      | awk 'NR > 1 { split($9, address, ":"); port=address[length(address)]; if (port ~ /^[0-9]+$/ && port >= 3000 && port < 4000) print port }' \
      | sort -n -u
    return 0
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltnH 2>/dev/null \
      | awk '{ split($4, address, ":"); port=address[length(address)]; if (port ~ /^[0-9]+$/ && port >= 3000 && port < 4000) print port }' \
      | sort -n -u
    return 0
  fi

  seq 3000 3999
}

detect_local_server_url() {
  local candidate_url port

  if url_responds "${DEFAULT_LOCAL_SERVER_URL}"; then
    printf '%s\n' "${DEFAULT_LOCAL_SERVER_URL}"
    return 0
  fi

  while read -r port; do
    [ -n "${port}" ] || continue
    candidate_url="http://${DEFAULT_LOCAL_SERVER_HOST}:${port}"

    if [ "${candidate_url}" = "${DEFAULT_LOCAL_SERVER_URL}" ]; then
      continue
    fi

    if is_next_app_url "${candidate_url}"; then
      printf '%s\n' "${candidate_url}"
      return 0
    fi
  done < <(list_workspace_next_dev_ports)

  while read -r port; do
    [ -n "${port}" ] || continue
    candidate_url="http://${DEFAULT_LOCAL_SERVER_HOST}:${port}"

    if [ "${candidate_url}" = "${DEFAULT_LOCAL_SERVER_URL}" ]; then
      continue
    fi

    if is_next_app_url "${candidate_url}"; then
      printf '%s\n' "${candidate_url}"
      return 0
    fi
  done < <(list_candidate_ports)

  return 1
}

main() {
  local local_server_url emulator_server_url emulator_serial

  local_server_url="${LOCAL_SERVER_URL:-}"
  emulator_server_url="${CAPACITOR_SERVER_URL:-}"

  if ! command -v adb >/dev/null 2>&1; then
    echo "adb no esta instalado o no esta en PATH." >&2
    exit 1
  fi

  if ! command -v curl >/dev/null 2>&1; then
    echo "curl no esta disponible." >&2
    exit 1
  fi

  emulator_serial="$(adb devices | awk 'NR > 1 && $1 ~ /^emulator-/ && $2 == "device" { print $1; exit }')"

  if [ -z "${emulator_serial}" ]; then
    echo "No hay un emulador Android conectado. Ejecuta 'npm run android:start:emulator' en otra terminal y vuelve a intentar." >&2
    exit 1
  fi

  if [ -z "${local_server_url}" ]; then
    local_server_url="$(detect_local_server_url)" || {
      cat >&2 <<EOF
No pude alcanzar ${DEFAULT_LOCAL_SERVER_URL} ni detectar otra instancia Next para este workspace.
Ejecuta 'npm run dev' antes de instalar en el emulador o define LOCAL_SERVER_URL/CAPACITOR_SERVER_URL manualmente.
EOF
      exit 1
    }
  fi

  if ! url_responds "${local_server_url}"; then
    echo "No pude alcanzar ${local_server_url}. Ejecuta 'npm run dev' antes de instalar en el emulador." >&2
    exit 1
  fi

  if [ -z "${emulator_server_url}" ]; then
    emulator_server_url="$(derive_emulator_url "${local_server_url}")" || {
      echo "No pude derivar la URL del emulador a partir de ${local_server_url}. Define CAPACITOR_SERVER_URL manualmente." >&2
      exit 1
    }
  fi

  echo "Usando emulador ${emulator_serial}"
  echo "Servidor local ${local_server_url}"
  echo "Sincronizando Android con ${emulator_server_url}"
  CAPACITOR_SERVER_URL="${emulator_server_url}" npm run android:sync

  echo "Instalando APK debug en ${emulator_serial}"
  (
    cd android
    ./gradlew installDebug
  )

  adb -s "${emulator_serial}" shell am force-stop "${APP_ID}" >/dev/null 2>&1 || true
  adb -s "${emulator_serial}" shell am start -n "${APP_ID}/${MAIN_ACTIVITY}" >/dev/null

  echo "RutaCero lanzada en ${emulator_serial}"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
