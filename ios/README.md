# LiteCAD native iOS

This directory contains the native large-DWG route for CAD Viewer.

## Current slice

- `LiteCADCore`: platform-neutral, compact scene graph model with packed line
  geometry, block definitions/instances, camera state, fit-to-view, anchored
  zoom, pan, and block-instance viewport culling.
- `LibreDWGBridge`: pinned LibreDWG C adapter for iPhoneOS arm64, exposing
  compact lines, text annotations, HATCH polygons, layer styles, common
  dimension graphics, and BLOCK instance matrices without passing LibreDWG
  structs into Swift.

The adapter is built reproducibly from LibreDWG commit
`34f02f54b9aacb5708c1d3d2070efb3e4b2d8c43` with
`LibreDWGBridge/build-libredwg-ios.sh`. The generated archive is intentionally
external and ignored; GPLv3+ distribution obligations still require review.

## Implemented vertical slice

```text
Files importer → native DWG bridge → SceneGraph → Metal viewport
              → pan / pinch zoom / double-tap anchored zoom / layer visibility
              → distance / area / angle / coordinate / scale calibration
              → select / inspect / local markup / font management
              → TEXT / MTEXT / DIMENSION annotation overlay
              → field measurement-first controls / text search and focus
              → loading cancellation / snapshot sharing / history reopening
              → independent RoomScan module for LiDAR room/furniture capture
```

The renderer uses block instances and view culling. It does not reuse the Web
parser's flattened INSERT output as its storage model. TEXT/MTEXT/DIMENSION
labels are transferred as compact annotations and rendered through native
text layers with viewport/layer culling. TTF/OTF files can be imported and
registered for the current app process; SHX uses an explicit engineering-mono
fallback when its native glyph metrics are unavailable. The default Xcode build keeps
LibreDWG disabled until an externally built archive is supplied; the
bridge-enabled build command is documented in `LibreDWGBridge/README.md`. The
initial delivery build pauses the Metal frame loop in the background and resumes
it in the foreground, while close/reopen cancels stale UI load results.

## P1 rendering coverage

- HATCH polyline boundaries can be triangulated into translucent Metal fills;
  hole paths are retained in the scene graph and intentionally skipped by the
  first fill pass until even-odd triangulation is added.
- Linear/aligned/radius/diameter/angular/ordinate dimensions emit extension,
  dimension, leader, and arrow geometry in addition to their text.
- Layer names map common DASH/HIDDEN, DOT, and CENTER patterns to CPU-styled
  segments. Explicit DWG lineweights use a zoom-stable Metal thick-line path;
  exact custom dash definitions are not yet transported from LibreDWG.
- LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, ELLIPSE, SPLINE, POINT, SOLID,
  TRACE, 3DFACE, HATCH, INSERT/MINSERT, TEXT, MTEXT, RAY, XLINE, and LEADER
  are covered by the bridge. Unknown entity classes remain non-rendering by
  design and should be added with a focused fixture before being advertised as
  supported.

## P2 editing slice

- Root LINE, TEXT/MTEXT/DIMENSION annotations, and HATCH boundary polygons
  support move, rotate, duplicate, and delete from the selection inspector.
  BLOCK/INSERT selections edit the instance transform; shared block-definition
  geometry is not flattened or copied for each instance.
- Undo and redo keep value-semantic scene snapshots, while the corresponding
  edit operations are written to an app-private JSON journal under
  `Application Support/LiteCAD/EditJournal`. Reopening the same DWG rebuilds the
  scene from the original parse plus valid journal entries.
- Successful file opens are also added to an app-private history index at
  `Application Support/LiteCAD/document-history.json` (up to 20 records). The
  launch screen and the edit-history menu expose the file name, last-opened time,
  **打开**, and delete actions. iOS bookmark data is retained so a history item
  can be reopened after the Files provider changes its temporary URL; if the
  source is no longer available, the app asks the user to select it again.
- The journal is intentionally separate from the source DWG. P2 provides an
  explicit **导出 DXF 副本** action; it never overwrites the source DWG. The DXF
  export flattens BLOCK transforms into portable LINE/LWPOLYLINE/TEXT/MTEXT
  entities so the edited visual result remains portable.
- A selected annotation inside a BLOCK edits the containing instance transform;
  editing the shared definition itself remains outside the first native pass.

## Field workflow

The primary workflow is offline site review rather than general-purpose CAD
authoring:

- **测量** is a primary bottom-toolbar mode. Distance, continuous multi-segment
  distance, three-point circle/radius/diameter/circumference, area, angle,
  coordinate, scale calibration, and snap-assisted
  picking share the same visible first-point/path-point overlay.
- The measurement card shows the active unit and precision; the latest point
  can be undone without discarding the whole measurement. Double-tap completes
  area and continuous-distance paths, while **清除** resets the tool.
- **查找** searches TEXT/MTEXT in model space and transformed BLOCK instances,
  then focuses the viewport on the selected result. **全图** returns to the
  drawing overview.
- Loading can be cancelled before the result is committed. **分享现场图**
  produces the current native viewport image for a field report or message;
  the source DWG remains unchanged.
- Advanced scene edits are opt-in from the edit menu, keeping the default site
  workflow focused on view, measure, locate, layers, notes, and fonts.

## Independent 3D scanning modules

The **3D 扫描** button opens a module switcher with two independent workflows.
Neither changes the DWG SceneGraph or starts a scan from the CAD renderer.

### 家装设计 3D 扫描

This workflow uses RoomPlan for room-scale capture:

- LiDAR capability is checked before starting. Unsupported devices show a
  clear fallback message and retain DWG viewing and CAD measurement.
- A supported iPhone can scan walls, floors, doors, windows, and RoomPlan's
  supported furniture categories. The scan shows coaching/instruction and a
  processing state before presenting the result.
- **保存 3D** stores a USDZ mesh and a Codable RoomPlan JSON snapshot under
  `Application Support/LiteCAD/RoomScans`, registers the scan in the in-app
  **扫描文件** list, and opens the iOS share sheet. The list can reopen a
  saved USDZ, share both the USDZ and RoomPlan JSON, or delete the local copy.
  When Google Drive, 阿里云盘, iCloud Drive, or another provider is installed,
  its iOS share extension can be selected from **分享 / 云端**; LiteCAD does
  not collect or store those provider credentials.
- The USDZ preview uses SceneKit camera controls: one-finger rotation,
  two-finger translation/pan, and pinch zoom. Files can also import a USDZ
  from the system Files picker into the private scan area for immediate review.

### 景物静物扫描

This workflow uses Object Capture plus Photogrammetry for a single object such
as furniture, equipment, a fixture, or a site sample:

- The app guides the user through object detection and a slow orbit capture,
  then generates a USDZ model locally from the captured image set.
- The result is stored under `Application Support/LiteCAD/ObjectScans`, listed
  in **静物模型文件**, and supports the same open, delete, share/cloud, USDZ
  import, and 3D rotate/pan/zoom operations as the room workflow.
- It is intended for visual reference and field coordination. It does not
  promise survey-grade dimensions, hidden-surface reconstruction, or reliable
  results for reflective, transparent, textureless, moving, or very thin
  objects; those conditions require a controlled capture setup or manual CAD
  verification.

## LiDAR / actual-equipment verification assessment

LiDAR is a suitable optional **field verification mode**, not a replacement
for DWG parsing and not an automatic CAD recognizer. On LiDAR-capable iPhones,
ARKit `sceneDepth` provides a depth map in meters and a confidence map; the
app can turn that into a point cloud or reconstructed visible surface. The
current delivery does not pretend this mode is already complete: the ARKit
capture and CAD registration pipeline is the next isolated feature slice.
The recommended first version is:

1. Keep the DWG in the native SceneGraph and ask the user to select three or
   more known CAD control points (for example, column corners or equipment
   centers).
2. Capture the corresponding physical points with ARKit and solve a checked
   2D/3D registration with explicit scale and residual error.
3. Show the registered CAD overlay, point-to-point distance, clearance, and
   deviation/tolerance colors. Require manual confirmation before recording a
   result and export a photo/report rather than writing back to DWG.
4. Fall back to ordinary CAD measurement on devices without LiDAR or when the
   depth confidence is low.

This mode is high-feasibility for visible floor/wall/equipment clearance and
rough as-built verification, medium-feasibility for a scaled plan overlay when
control points are available, and low-feasibility for automatically recognizing
an arbitrary steel structure, hidden members, or semantic CAD objects. Thin,
dark, reflective, or occluded surfaces can have weak depth confidence, and the
result is not survey-grade without a site calibration procedure. Apple
RoomPlan should not be used as the CAD import path: it is designed to recognize
rooms and common room objects, not arbitrary plant equipment or DWG entities.

## Remaining delivery gates

- Native DWG write-back remains outside this P2 slice because the pinned bridge
  currently exposes LibreDWG reading only. The safe delivery is the explicit
  DXF copy export plus the recoverable app-private edit journal.
- Nested BLOCK definition editing remains separate from instance editing and
  needs its own identity model before it can be enabled safely.
- Rendering fidelity: add even-odd HATCH hole filling, transport exact custom
  linetype definitions, and cover currently unknown entity classes with focused
  real-file fixtures.
- Initial delivery hardening completed: real AC1021/R2007 open, close/reopen,
  history persistence, simulator and physical-iPhone launch, and explicit
  background Metal pause/resume behavior are covered. Extended memory-pressure
  soak and long-duration performance profiling remain post-initial-release work.
- Distribution: confirm the supported input-format list, TestFlight/signing
  workflow, and LibreDWG GPLv3+ source/distribution obligations before release.
