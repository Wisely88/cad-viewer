#!/usr/bin/env bash
set -euo pipefail

readonly expected_revision="34f02f54b9aacb5708c1d3d2070efb3e4b2d8c43"
readonly project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
readonly bridge_root="$project_root/ios/LibreDWGBridge"

if [[ -z "${LIBREDWG_SOURCE:-}" ]]; then
  printf '%s\n' 'LIBREDWG_SOURCE must point to the pinned LibreDWG checkout.' >&2
  exit 2
fi

readonly source_root="$(cd "$LIBREDWG_SOURCE" && pwd -P)"
readonly build_root="${LIBREDWG_BUILD_DIR:-$project_root/ios/.build/libredwg-ios}"
readonly archive_path="${LIBREDWG_ARCHIVE:-$project_root/ios/.build/libLiteCADBridge-ios.a}"
readonly sdk_name="${LIBREDWG_SDK:-iphoneos}"
readonly target_triple="${LIBREDWG_TARGET_TRIPLE:-arm64-apple-ios17.0}"
readonly sdk_path="$(xcrun --sdk "$sdk_name" --show-sdk-path)"
readonly clang_path="$(xcrun --sdk "$sdk_name" -f clang)"

actual_revision="$(git -C "$source_root" rev-parse HEAD)"
if [[ "$actual_revision" != "$expected_revision" ]]; then
  printf 'LibreDWG revision mismatch: expected %s, got %s\n' \
    "$expected_revision" "$actual_revision" >&2
  exit 3
fi

cmake -S "$source_root" -B "$build_root" -G 'Unix Makefiles' \
  -DCMAKE_SYSTEM_NAME=iOS \
  -DCMAKE_C_COMPILER="$clang_path" \
  -DCMAKE_OSX_SYSROOT="$sdk_path" \
  -DCMAKE_OSX_ARCHITECTURES=arm64 \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=17.0 \
  -DCMAKE_C_FLAGS=-D_DARWIN_C_SOURCE \
  -DHAVE_ENDIAN_H:INTERNAL=0 \
  -DBUILD_SHARED_LIBS=OFF \
  -DLIBREDWG_LIBONLY=ON \
  -DLIBREDWG_DISABLE_WRITE=ON \
  -DLIBREDWG_DISABLE_JSON=ON \
  -DENABLE_LTO=OFF \
  -DDISABLE_WERROR=ON

cmake --build "$build_root" --target redwg --parallel 4

mkdir -p "$(dirname "$archive_path")"
"$clang_path" \
  -target "$target_triple" \
  -std=gnu99 \
  -D_DARWIN_C_SOURCE \
  -isysroot "$sdk_path" \
  -I"$bridge_root" \
  -I"$source_root/include" \
  -I"$source_root/src" \
  -I"$build_root/src" \
  -c "$bridge_root/LibreDWGBridge.c" \
  -o "$build_root/LibreDWGBridge.o"

/usr/bin/libtool -static \
  -o "$archive_path" \
  "$build_root/LibreDWGBridge.o" \
  "$build_root/libredwg.a"

printf 'Built %s\n' "$archive_path"
