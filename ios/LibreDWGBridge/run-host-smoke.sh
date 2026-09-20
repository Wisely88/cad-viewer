#!/usr/bin/env bash
set -euo pipefail

readonly project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
readonly bridge_root="$project_root/ios/LibreDWGBridge"
readonly source_root="$(cd "${LIBREDWG_SOURCE:?LIBREDWG_SOURCE is required}" && pwd -P)"
readonly build_root="$(cd "${LIBREDWG_BUILD_DIR:?LIBREDWG_BUILD_DIR is required}" && pwd -P)"
readonly smoke_root="${LIBREDWG_SMOKE_BUILD_DIR:-/private/tmp/litecad-bridge-smoke}"
readonly cc="${CC:-clang}"

mkdir -p "$smoke_root"

"$cc" \
  -std=gnu99 \
  -D_DARWIN_C_SOURCE \
  -I"$bridge_root" \
  -I"$source_root/include" \
  -I"$source_root/src" \
  -I"$build_root/src" \
  -c "$bridge_root/LibreDWGBridge.c" \
  -o "$smoke_root/LibreDWGBridge.o"

"$cc" \
  -std=gnu99 \
  -I"$bridge_root" \
  "$bridge_root/bridge-smoke.c" \
  "$smoke_root/LibreDWGBridge.o" \
  "$build_root/libredwg.a" \
  -lm \
  -liconv \
  -o "$smoke_root/bridge-smoke"

exec "$smoke_root/bridge-smoke" "${DWG_PATH:?DWG_PATH is required}"
