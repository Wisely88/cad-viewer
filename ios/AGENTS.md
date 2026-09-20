# Native iOS LiteCAD rules

## Scope

`ios/` is the primary route for large local DWG files. The existing Web/PWA
viewer remains a lightweight DXF/small-file fallback and must not be used as the
native renderer through WKWebView.

## Boundaries

- SwiftUI owns app presentation and navigation.
- UIKit/`MTKView` owns file import, gestures, and Metal presentation where needed.
- `LiteCADCore` owns platform-neutral scene data and validation.
- `LibreDWGBridge` owns the C/Objective-C++ boundary only; it must not expose
  LibreDWG structs to Swift.
- The renderer consumes `BlockDefinition + BlockInstance` data and must not
  expand repeated block geometry into per-instance copies.
- No DWG bytes, API keys, or private file contents leave the device.

## Verification

- Core model changes require Swift unit tests.
- Parser/bridge changes require fixture tests using real DWG versions and
  malformed-input cases.
- Renderer changes require a real-device check for memory, frame time, gestures,
  background/foreground, and memory-pressure recovery.
- Do not claim an iOS build until the installed Xcode toolchain and signing
  state are verified. LibreDWG licensing must be reviewed before distribution.
