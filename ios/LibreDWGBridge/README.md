# LibreDWG bridge boundary

`LibreDWGBridge.h` and `LibreDWGBridge.c` define the narrow callback boundary
consumed by the native Scene Graph builder. The adapter reads a local path and
exposes only normalized 2D lines and affine BLOCK instances; LibreDWG structs
must not cross into Swift.

The current adapter is pinned and verified against LibreDWG `0.14.8597`,
commit `34f02f54b9aacb5708c1d3d2070efb3e4b2d8c43`. Its current conversion
scope is LINE, LWPOLYLINE (including bulge tessellation), CIRCLE, ARC, ELLIPSE,
SPLINE fallback polylines, INSERT, MINSERT, TEXT, MTEXT, and DIMENSION text
summaries. Unsupported entities are ignored so a large drawing can still load;
the supported-entity coverage must be expanded with fixture tests before
claiming full DWG fidelity.

Build LibreDWG outside the repository with Apple Clang using the checked-in
script. It refuses to build a different source revision:

```bash
LIBREDWG_SOURCE=/path/to/libredwg \
  bash ios/LibreDWGBridge/build-libredwg-ios.sh
```

The same script can build a simulator arm64 archive for local validation:

```bash
LIBREDWG_SOURCE=/path/to/libredwg \
LIBREDWG_SDK=iphonesimulator \
LIBREDWG_TARGET_TRIPLE=arm64-apple-ios17.0-simulator \
LIBREDWG_ARCHIVE=/private/tmp/libLiteCADBridge-ios-simulator.a \
  bash ios/LibreDWGBridge/build-libredwg-ios.sh
```

The resulting arm64 archive is intentionally written under `ios/.build/` and
is not tracked. To compile the App target with the bridge enabled, pass the
generated archive to Xcode and link Apple's iconv library:

```bash
xcodebuild -project ios/LiteCADApp.xcodeproj -scheme LiteCAD -sdk iphoneos \
  -configuration Debug -derivedDataPath /private/tmp/litecad-derived \
  CODE_SIGNING_ALLOWED=NO \
  'SWIFT_ACTIVE_COMPILATION_CONDITIONS=$(inherited) LITECAD_LIBREDWG_ENABLED' \
  'OTHER_LDFLAGS=$(inherited) -force_load /absolute/path/to/libLiteCADBridge-ios.a -liconv' \
  build
```

The default Xcode build deliberately leaves the bridge disabled until this
external archive is supplied. The DWG path remains device-local, parsing is
synchronous inside the C call, and the Swift loader keeps the security-scoped
URL alive for that call. INSERT/MINSERT callbacks are retained both in model
space and inside BLOCK definitions, so nested block transforms remain compact
and can be composed by the native renderer without flattening repeated geometry.
The native text overlay decodes common UTF-8/GB18030 DWG text, supports TTF/OTF
registration from the app's font panel, and normalizes common MTEXT control
codes. SHX glyph metrics still use an explicit engineering-mono fallback. The
GPLv3+ source and binary distribution
obligations must be reviewed before shipping the library in a public App Store
build.

For a host-side parse smoke test against a real DWG, first build the host
LibreDWG library, then run the checked-in callback counter without copying the
DWG into the repository:

```bash
LIBREDWG_SOURCE=/path/to/libredwg \
LIBREDWG_BUILD_DIR=/path/to/host-libredwg-build \
DWG_PATH=/path/to/file.dwg \
  bash ios/LibreDWGBridge/run-host-smoke.sh
```

For simulator end-to-end loading, copy a DWG into the App's simulator
`Documents` container and launch with `--test-dwg /absolute/path/in/container`.
This test-only launch argument exercises the same Swift loader used by the
Files picker; normal launches do not auto-open a file.
