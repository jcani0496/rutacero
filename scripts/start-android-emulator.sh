#!/bin/bash

set -euo pipefail

SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
EMULATOR_BIN="${ANDROID_EMULATOR_BIN:-$SDK_ROOT/emulator/emulator}"
ADB_BIN="${ANDROID_ADB_BIN:-${ADB_BIN:-$SDK_ROOT/platform-tools/adb}}"

if ! [ -x "${EMULATOR_BIN}" ]; then
  echo "No encontre el binario del emulador en ${EMULATOR_BIN}. Define ANDROID_HOME o ANDROID_SDK_ROOT." >&2
  exit 1
fi

if ! [ -x "${ADB_BIN}" ]; then
  if command -v adb >/dev/null 2>&1; then
    ADB_BIN="$(command -v adb)"
  else
    echo "No encontre adb en PATH ni en ${ADB_BIN}." >&2
    exit 1
  fi
fi

list_emulator_serials() {
  "${ADB_BIN}" devices | awk 'NR > 1 && $1 ~ /^emulator-/ { print $1 }'
}

pick_avd_name() {
  if [ -n "${ANDROID_EMULATOR_AVD:-}" ]; then
    printf '%s\n' "${ANDROID_EMULATOR_AVD}"
    return
  fi

  "${EMULATOR_BIN}" -list-avds | awk 'NF { print; exit }'
}

default_gpu_mode() {
  if [ -n "${ANDROID_EMULATOR_GPU_MODE:-}" ]; then
    printf '%s\n' "${ANDROID_EMULATOR_GPU_MODE}"
    return
  fi

  if [ "$(uname -s)" = "Darwin" ] && [ "$(uname -m)" = "arm64" ]; then
    printf '%s\n' "swiftshader_indirect"
    return
  fi

  printf '%s\n' "auto"
}

default_disable_vulkan() {
  if [ -n "${ANDROID_EMULATOR_DISABLE_VULKAN:-}" ]; then
    printf '%s\n' "${ANDROID_EMULATOR_DISABLE_VULKAN}"
    return
  fi

  if [ "$(uname -s)" = "Darwin" ] && [ "$(uname -m)" = "arm64" ]; then
    printf '%s\n' "1"
    return
  fi

  printf '%s\n' "0"
}

if [ -n "$(list_emulator_serials | awk 'NF { print; exit }')" ]; then
  echo "Ya hay un emulador Android en ejecucion:"
  list_emulator_serials
  exit 0
fi

AVD_NAME="$(pick_avd_name)"

if [ -z "${AVD_NAME}" ]; then
  echo "No encontre ningun AVD. Crea uno desde Android Studio > Device Manager antes de continuar." >&2
  exit 1
fi

GPU_MODE="$(default_gpu_mode)"
DISABLE_VULKAN="$(default_disable_vulkan)"
EXTRA_ARGS_STRING="${ANDROID_EMULATOR_EXTRA_ARGS:-}"

ARGS=(
  -avd "${AVD_NAME}"
  -gpu "${GPU_MODE}"
)

if [ "${ANDROID_EMULATOR_NO_SNAPSHOT_LOAD:-1}" = "1" ]; then
  ARGS+=(-no-snapshot-load)
fi

if [ "${DISABLE_VULKAN}" = "1" ]; then
  ARGS+=(-feature -Vulkan)
fi

if [ -n "${EXTRA_ARGS_STRING}" ]; then
  # shellcheck disable=SC2206
  EXTRA_ARGS=( ${EXTRA_ARGS_STRING} )
  ARGS+=("${EXTRA_ARGS[@]}")
fi

echo "Iniciando AVD ${AVD_NAME}"
echo "Renderer GPU: ${GPU_MODE}"
if [ "${DISABLE_VULKAN}" = "1" ]; then
  echo "Vulkan: deshabilitado"
fi
echo "El proceso queda en primer plano. Abre otra terminal para 'npm run android:run:emulator'."

exec "${EMULATOR_BIN}" "${ARGS[@]}"
