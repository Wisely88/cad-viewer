# LiteCAD iOS app integration boundary

The reusable native interaction model lives in `LiteCADCore` so it can be
tested without a UI target. The Xcode app target connects:

```text
SwiftUI shell
  ├── Files document picker
  ├── CADViewportState
  ├── MTKView / Metal renderer
  └── LibreDWGBridge callbacks → Swift collector → CADSceneBuilder
```

The Metal renderer must consume the viewport's visible instance list and keep
block geometry in definition buffers. It must never flatten all INSERT entities
on the main thread or pass DWG data through WebKit/WASM. The default target
build keeps LibreDWG disabled until an external arm64 archive is supplied; see
`../LibreDWGBridge/README.md` for the bridge-enabled build command.
