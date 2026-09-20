#if os(iOS)
import LiteCADCore
import MetalKit
import SwiftUI
import UIKit

public struct LiteCADMetalView: UIViewRepresentable {
    public let scene: CADScene
    public let isActive: Bool
    public let viewport: CADViewportState
    public let interactionMode: CADInteractionMode
    public let fitRequest: Int
    public let focusRequest: Int
    public let focusPoint: CADPoint?
    public let snapshotRequest: Int
    public let hiddenLayers: Set<UInt16>
    public let measurement: CADMeasurement?
    public let pathMeasurement: CADPathMeasurement?
    public let circleMeasurement: CADCircleMeasurement?
    public let pendingMeasurementPoint: CADPoint?
    public let measurementTool: CADMeasurementTool
    public let measurementPoints: [CADPoint]
    public let areaMeasurement: CADAreaMeasurement?
    public let angleMeasurement: CADAngleMeasurement?
    public let coordinatePoint: CADPoint?
    public let snapEnabled: Bool
    public let pendingSnapResult: CADSnapResult?
    public let selection: CADSelectionResult?
    public let markups: [CADMarkup]
    public let textFontMode: CADTextFontMode
    public let customFontName: String?
    public let onMeasurement: (CADMeasurement?) -> Void
    public let onPendingMeasurementPoint: (CADPoint?) -> Void
    public let onSnap: (CADSnapResult?) -> Void
    public let onAreaMeasurement: (CADAreaMeasurement?) -> Void
    public let onPathMeasurement: (CADPathMeasurement?) -> Void
    public let onCircleMeasurement: (CADCircleMeasurement?) -> Void
    public let onAngleMeasurement: (CADAngleMeasurement?) -> Void
    public let onCoordinatePoint: (CADPoint?) -> Void
    public let onCalibrationDistance: (Float?) -> Void
    public let onSelection: (CADSelectionResult?) -> Void
    public let onMarkupPoint: (CADPoint?) -> Void
    public let onSnapshot: (UIImage) -> Void

    public init(
        scene: CADScene,
        isActive: Bool = true,
        viewport: CADViewportState,
        interactionMode: CADInteractionMode = .pan,
        fitRequest: Int = 0,
        focusRequest: Int = 0,
        focusPoint: CADPoint? = nil,
        snapshotRequest: Int = 0,
        hiddenLayers: Set<UInt16> = [],
        measurement: CADMeasurement? = nil,
        pathMeasurement: CADPathMeasurement? = nil,
        circleMeasurement: CADCircleMeasurement? = nil,
        pendingMeasurementPoint: CADPoint? = nil,
        measurementTool: CADMeasurementTool = .distance,
        measurementPoints: [CADPoint] = [],
        areaMeasurement: CADAreaMeasurement? = nil,
        angleMeasurement: CADAngleMeasurement? = nil,
        coordinatePoint: CADPoint? = nil,
        snapEnabled: Bool = true,
        pendingSnapResult: CADSnapResult? = nil,
        selection: CADSelectionResult? = nil,
        markups: [CADMarkup] = [],
        textFontMode: CADTextFontMode = .system,
        customFontName: String? = nil,
        onMeasurement: @escaping (CADMeasurement?) -> Void = { _ in },
        onPendingMeasurementPoint: @escaping (CADPoint?) -> Void = { _ in },
        onSnap: @escaping (CADSnapResult?) -> Void = { _ in },
        onAreaMeasurement: @escaping (CADAreaMeasurement?) -> Void = { _ in },
        onPathMeasurement: @escaping (CADPathMeasurement?) -> Void = { _ in },
        onCircleMeasurement: @escaping (CADCircleMeasurement?) -> Void = { _ in },
        onAngleMeasurement: @escaping (CADAngleMeasurement?) -> Void = { _ in },
        onCoordinatePoint: @escaping (CADPoint?) -> Void = { _ in },
        onCalibrationDistance: @escaping (Float?) -> Void = { _ in },
        onSelection: @escaping (CADSelectionResult?) -> Void = { _ in },
        onMarkupPoint: @escaping (CADPoint?) -> Void = { _ in },
        onSnapshot: @escaping (UIImage) -> Void = { _ in }
    ) {
        self.scene = scene
        self.isActive = isActive
        self.viewport = viewport
        self.interactionMode = interactionMode
        self.fitRequest = fitRequest
        self.focusRequest = focusRequest
        self.focusPoint = focusPoint
        self.snapshotRequest = snapshotRequest
        self.hiddenLayers = hiddenLayers
        self.measurement = measurement
        self.pathMeasurement = pathMeasurement
        self.circleMeasurement = circleMeasurement
        self.pendingMeasurementPoint = pendingMeasurementPoint
        self.measurementTool = measurementTool
        self.measurementPoints = measurementPoints
        self.areaMeasurement = areaMeasurement
        self.angleMeasurement = angleMeasurement
        self.coordinatePoint = coordinatePoint
        self.snapEnabled = snapEnabled
        self.pendingSnapResult = pendingSnapResult
        self.selection = selection
        self.markups = markups
        self.textFontMode = textFontMode
        self.customFontName = customFontName
        self.onMeasurement = onMeasurement
        self.onPendingMeasurementPoint = onPendingMeasurementPoint
        self.onSnap = onSnap
        self.onAreaMeasurement = onAreaMeasurement
        self.onPathMeasurement = onPathMeasurement
        self.onCircleMeasurement = onCircleMeasurement
        self.onAngleMeasurement = onAngleMeasurement
        self.onCoordinatePoint = onCoordinatePoint
        self.onCalibrationDistance = onCalibrationDistance
        self.onSelection = onSelection
        self.onMarkupPoint = onMarkupPoint
        self.onSnapshot = onSnapshot
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    public func makeUIView(context: Context) -> MTKView {
        guard let device = MTLCreateSystemDefaultDevice() else {
            fatalError("Metal is unavailable on this device")
        }

        let view = MTKView(frame: .zero, device: device)
        view.colorPixelFormat = .bgra8Unorm
        view.clearColor = MTLClearColor(red: 0.035, green: 0.045, blue: 0.06, alpha: 1)
        view.isPaused = !isActive
        view.enableSetNeedsDisplay = false

        guard let renderer = LiteCADMetalRenderer(view: view, scene: scene, viewport: viewport) else {
            fatalError("Unable to create the LiteCAD Metal pipeline")
        }
        context.coordinator.renderer = renderer
        view.delegate = renderer

        let pan = UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handlePan(_:)))
        let pinch = UIPinchGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handlePinch(_:)))
        let doubleTap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleDoubleTap(_:)))
        doubleTap.numberOfTapsRequired = 2
        let singleTap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleSingleTap(_:)))
        singleTap.numberOfTapsRequired = 1
        singleTap.require(toFail: doubleTap)
        view.addGestureRecognizer(pan)
        view.addGestureRecognizer(pinch)
        view.addGestureRecognizer(doubleTap)
        view.addGestureRecognizer(singleTap)
        context.coordinator.configure(
            interactionMode: interactionMode,
            fitRequest: fitRequest,
            focusRequest: focusRequest,
            focusPoint: focusPoint,
            snapshotRequest: snapshotRequest,
            hiddenLayers: hiddenLayers,
            measurement: measurement,
            pathMeasurement: pathMeasurement,
            circleMeasurement: circleMeasurement,
            pendingMeasurementPoint: pendingMeasurementPoint,
            measurementTool: measurementTool,
            measurementPoints: measurementPoints,
            areaMeasurement: areaMeasurement,
            angleMeasurement: angleMeasurement,
            coordinatePoint: coordinatePoint,
            snapEnabled: snapEnabled,
            pendingSnapResult: pendingSnapResult,
            selection: selection,
            markups: markups,
            textFontMode: textFontMode,
            customFontName: customFontName,
            onMeasurement: onMeasurement,
            onPendingMeasurementPoint: onPendingMeasurementPoint,
            onSnap: onSnap,
            onAreaMeasurement: onAreaMeasurement,
            onPathMeasurement: onPathMeasurement,
            onCircleMeasurement: onCircleMeasurement,
            onAngleMeasurement: onAngleMeasurement,
            onCoordinatePoint: onCoordinatePoint,
            onCalibrationDistance: onCalibrationDistance,
            onSelection: onSelection,
            onMarkupPoint: onMarkupPoint,
            onSnapshot: onSnapshot
        )
        return view
    }

    public func updateUIView(_ view: MTKView, context: Context) {
        view.isPaused = !isActive
        context.coordinator.renderer?.update(
            scene: scene,
            viewport: viewport,
            hiddenLayers: hiddenLayers
        )
        context.coordinator.configure(
            interactionMode: interactionMode,
            fitRequest: fitRequest,
            focusRequest: focusRequest,
            focusPoint: focusPoint,
            snapshotRequest: snapshotRequest,
            hiddenLayers: hiddenLayers,
            measurement: measurement,
            pathMeasurement: pathMeasurement,
            circleMeasurement: circleMeasurement,
            pendingMeasurementPoint: pendingMeasurementPoint,
            measurementTool: measurementTool,
            measurementPoints: measurementPoints,
            areaMeasurement: areaMeasurement,
            angleMeasurement: angleMeasurement,
            coordinatePoint: coordinatePoint,
            snapEnabled: snapEnabled,
            pendingSnapResult: pendingSnapResult,
            selection: selection,
            markups: markups,
            textFontMode: textFontMode,
            customFontName: customFontName,
            onMeasurement: onMeasurement,
            onPendingMeasurementPoint: onPendingMeasurementPoint,
            onSnap: onSnap,
            onAreaMeasurement: onAreaMeasurement,
            onPathMeasurement: onPathMeasurement,
            onCircleMeasurement: onCircleMeasurement,
            onAngleMeasurement: onAngleMeasurement,
            onCoordinatePoint: onCoordinatePoint,
            onCalibrationDistance: onCalibrationDistance,
            onSelection: onSelection,
            onMarkupPoint: onMarkupPoint,
            onSnapshot: onSnapshot
        )
    }

    public final class Coordinator: NSObject {
        fileprivate var renderer: LiteCADMetalRenderer?
        fileprivate var interactionMode: CADInteractionMode = .pan
        fileprivate var measurementStart: CADPoint?
        fileprivate var toolPoints: [CADPoint] = []
        fileprivate var measurementTool: CADMeasurementTool = .distance
        fileprivate var snapEnabled = true
        fileprivate var onMeasurement: (CADMeasurement?) -> Void = { _ in }
        fileprivate var onPendingMeasurementPoint: (CADPoint?) -> Void = { _ in }
        fileprivate var onSnap: (CADSnapResult?) -> Void = { _ in }
        fileprivate var onAreaMeasurement: (CADAreaMeasurement?) -> Void = { _ in }
        fileprivate var onPathMeasurement: (CADPathMeasurement?) -> Void = { _ in }
        fileprivate var onCircleMeasurement: (CADCircleMeasurement?) -> Void = { _ in }
        fileprivate var onAngleMeasurement: (CADAngleMeasurement?) -> Void = { _ in }
        fileprivate var onCoordinatePoint: (CADPoint?) -> Void = { _ in }
        fileprivate var onCalibrationDistance: (Float?) -> Void = { _ in }
        fileprivate var onSelection: (CADSelectionResult?) -> Void = { _ in }
        fileprivate var onMarkupPoint: (CADPoint?) -> Void = { _ in }
        fileprivate var onSnapshot: (UIImage) -> Void = { _ in }
        private var lastFitRequest = 0
        private var lastFocusRequest = 0
        private var lastSnapshotRequest = 0

        fileprivate func configure(
            interactionMode: CADInteractionMode,
            fitRequest: Int,
            focusRequest: Int,
            focusPoint: CADPoint?,
            snapshotRequest: Int,
            hiddenLayers: Set<UInt16>,
            measurement: CADMeasurement?,
            pathMeasurement: CADPathMeasurement?,
            circleMeasurement: CADCircleMeasurement?,
            pendingMeasurementPoint: CADPoint?,
            measurementTool: CADMeasurementTool,
            measurementPoints: [CADPoint],
            areaMeasurement: CADAreaMeasurement?,
            angleMeasurement: CADAngleMeasurement?,
            coordinatePoint: CADPoint?,
            snapEnabled: Bool,
            pendingSnapResult: CADSnapResult?,
            selection: CADSelectionResult?,
            markups: [CADMarkup],
            textFontMode: CADTextFontMode,
            customFontName: String?,
            onMeasurement: @escaping (CADMeasurement?) -> Void,
            onPendingMeasurementPoint: @escaping (CADPoint?) -> Void,
            onSnap: @escaping (CADSnapResult?) -> Void,
            onAreaMeasurement: @escaping (CADAreaMeasurement?) -> Void,
            onPathMeasurement: @escaping (CADPathMeasurement?) -> Void,
            onCircleMeasurement: @escaping (CADCircleMeasurement?) -> Void,
            onAngleMeasurement: @escaping (CADAngleMeasurement?) -> Void,
            onCoordinatePoint: @escaping (CADPoint?) -> Void,
            onCalibrationDistance: @escaping (Float?) -> Void,
            onSelection: @escaping (CADSelectionResult?) -> Void,
            onMarkupPoint: @escaping (CADPoint?) -> Void,
            onSnapshot: @escaping (UIImage) -> Void
        ) {
            self.interactionMode = interactionMode
            self.measurementTool = measurementTool
            self.toolPoints = measurementPoints
            self.snapEnabled = snapEnabled
            self.onMeasurement = onMeasurement
            self.onPendingMeasurementPoint = onPendingMeasurementPoint
            self.onSnap = onSnap
            self.onAreaMeasurement = onAreaMeasurement
            self.onPathMeasurement = onPathMeasurement
            self.onCircleMeasurement = onCircleMeasurement
            self.onAngleMeasurement = onAngleMeasurement
            self.onCoordinatePoint = onCoordinatePoint
            self.onCalibrationDistance = onCalibrationDistance
            self.onSelection = onSelection
            self.onMarkupPoint = onMarkupPoint
            self.onSnapshot = onSnapshot
            if interactionMode != .measure {
                measurementStart = nil
            }
            if pendingMeasurementPoint == nil {
                measurementStart = nil
            }
            renderer?.setHiddenLayers(hiddenLayers)
            renderer?.setMeasurement(measurement)
            renderer?.setPathMeasurement(pathMeasurement)
            renderer?.setCircleMeasurement(circleMeasurement)
            renderer?.setPendingMeasurementPoint(pendingMeasurementPoint)
            renderer?.setSnapResult(pendingSnapResult)
            renderer?.setMeasurementTool(measurementTool)
            renderer?.setMeasurementPoints(measurementPoints)
            renderer?.setAreaMeasurement(areaMeasurement)
            renderer?.setAngleMeasurement(angleMeasurement)
            renderer?.setCoordinatePoint(coordinatePoint)
            renderer?.setSelection(selection)
            renderer?.setMarkups(markups)
            renderer?.setTextFontMode(textFontMode)
            renderer?.setCustomFontName(customFontName)
            if fitRequest != lastFitRequest {
                lastFitRequest = fitRequest
                renderer?.fit()
            }
            if focusRequest != lastFocusRequest {
                lastFocusRequest = focusRequest
                if let focusPoint {
                    renderer?.focus(on: focusPoint)
                }
            }
            if snapshotRequest != lastSnapshotRequest {
                lastSnapshotRequest = snapshotRequest
                if let image = renderer?.snapshot() {
                    onSnapshot(image)
                }
            }
        }

        @objc fileprivate func handlePan(_ gesture: UIPanGestureRecognizer) {
            guard interactionMode == .pan,
                  let view = gesture.view as? MTKView,
                  let renderer else { return }
            let delta = gesture.translation(in: view)
            let screenScaleX = Float(view.drawableSize.width / max(view.bounds.width, 1))
            let screenScaleY = Float(view.drawableSize.height / max(view.bounds.height, 1))
            renderer.pan(
                screenDeltaX: Float(delta.x) * screenScaleX,
                screenDeltaY: Float(delta.y) * screenScaleY
            )
            gesture.setTranslation(.zero, in: view)
        }

        @objc fileprivate func handlePinch(_ gesture: UIPinchGestureRecognizer) {
            guard let view = gesture.view as? MTKView, let renderer else { return }
            let location = gesture.location(in: view)
            let drawablePoint = drawablePoint(for: location, in: view)
            renderer.zoom(
                factor: Float(gesture.scale),
                anchorScreenX: Float(drawablePoint.x),
                anchorScreenY: Float(drawablePoint.y)
            )
            gesture.scale = 1
        }

        @objc fileprivate func handleDoubleTap(_ gesture: UITapGestureRecognizer) {
            guard let view = gesture.view as? MTKView,
                  let renderer else { return }
            let location = gesture.location(in: view)
            let drawablePoint = drawablePoint(for: location, in: view)
            if interactionMode == .measure && measurementTool == .area && toolPoints.count >= 3 {
                onAreaMeasurement(CADAreaMeasurement(points: toolPoints))
                toolPoints.removeAll()
                onPendingMeasurementPoint(nil)
                renderer.setPendingMeasurementPoint(nil)
                return
            }
            if interactionMode == .measure && measurementTool == .continuousDistance && toolPoints.count >= 2 {
                onPathMeasurement(CADPathMeasurement(points: toolPoints))
                toolPoints.removeAll()
                onPendingMeasurementPoint(nil)
                renderer.setPendingMeasurementPoint(nil)
                return
            }
            if interactionMode == .measure && measurementTool == .circle && toolPoints.count == 3 {
                onCircleMeasurement(CADCircleMeasurement(points: toolPoints))
                toolPoints.removeAll()
                onPendingMeasurementPoint(nil)
                renderer.setPendingMeasurementPoint(nil)
                return
            }
            renderer.zoom(
                factor: 2.5,
                anchorScreenX: Float(drawablePoint.x),
                anchorScreenY: Float(drawablePoint.y)
            )
        }

        @objc fileprivate func handleSingleTap(_ gesture: UITapGestureRecognizer) {
            guard let renderer,
                  let view = gesture.view as? MTKView else { return }
            let location = gesture.location(in: view)
            let rawPoint = renderer.worldPoint(in: view, point: location)
            let snapResult = renderer.snapPoint(
                in: view,
                point: location,
                enabled: snapEnabled
            )
            let point = snapResult?.point ?? rawPoint
            if interactionMode == .select {
                let selection = renderer.selection(in: view, point: location)
                onSelection(selection)
                renderer.setSelection(selection)
                return
            }
            if interactionMode == .markup {
                onMarkupPoint(point)
                return
            }
            guard interactionMode == .measure else { return }
            if measurementTool == .coordinate {
                onCoordinatePoint(point)
                renderer.setCoordinatePoint(point)
                return
            }
            if measurementTool == .angle {
                toolPoints.append(point)
                renderer.setMeasurementPoints(toolPoints)
                onPendingMeasurementPoint(point)
                if toolPoints.count == 3 {
                    let result = CADAngleMeasurement(start: toolPoints[0], vertex: toolPoints[1], end: toolPoints[2])
                    onAngleMeasurement(result)
                    toolPoints.removeAll()
                    onPendingMeasurementPoint(nil)
                }
                return
            }
            if measurementTool == .area {
                toolPoints.append(point)
                renderer.setMeasurementPoints(toolPoints)
                onPendingMeasurementPoint(point)
                return
            }
            if measurementTool == .continuousDistance {
                toolPoints.append(point)
                renderer.setMeasurementPoints(toolPoints)
                renderer.setSnapResult(snapResult)
                onPendingMeasurementPoint(point)
                onPathMeasurement(nil)
                return
            }
            if measurementTool == .circle {
                toolPoints.append(point)
                renderer.setMeasurementPoints(toolPoints)
                renderer.setSnapResult(snapResult)
                onPendingMeasurementPoint(point)
                onCircleMeasurement(nil)
                if toolPoints.count == 3 {
                    onCircleMeasurement(CADCircleMeasurement(points: toolPoints))
                    toolPoints.removeAll()
                    onPendingMeasurementPoint(nil)
                    renderer.setPendingMeasurementPoint(nil)
                    renderer.setSnapResult(nil)
                }
                return
            }
            if measurementTool == .calibration {
                if let measurementStart {
                    onCalibrationDistance(hypot(point.x - measurementStart.x, point.y - measurementStart.y))
                    self.measurementStart = nil
                    onPendingMeasurementPoint(nil)
                    renderer.setPendingMeasurementPoint(nil)
                } else {
                    measurementStart = point
                    renderer.setPendingMeasurementPoint(point)
                    onPendingMeasurementPoint(point)
                }
                return
            }
            if let measurementStart {
                renderer.setPendingMeasurementPoint(nil)
                renderer.setSnapResult(nil)
                onPendingMeasurementPoint(nil)
                onSnap(nil)
                onMeasurement(CADMeasurement(start: measurementStart, end: point))
                self.measurementStart = nil
            } else {
                measurementStart = point
                renderer.setPendingMeasurementPoint(point)
                renderer.setSnapResult(snapResult)
                onPendingMeasurementPoint(point)
                onSnap(snapResult)
                onMeasurement(nil)
            }
        }

        private func drawablePoint(for point: CGPoint, in view: MTKView) -> CGPoint {
            CGPoint(
                x: point.x * CGFloat(view.drawableSize.width / max(view.bounds.width, 1)),
                y: point.y * CGFloat(view.drawableSize.height / max(view.bounds.height, 1))
            )
        }
    }
}

private final class LiteCADMetalRenderer: NSObject, MTKViewDelegate {
    private struct Segment {
        var points: SIMD4<Float>
    }

    private struct ColorKey: Hashable {
        var rgb: UInt32
        var aci: UInt16
        var lineWeight: UInt16
        var linePattern: CADLinePattern
    }

    private struct InstanceTransform {
        var linear: SIMD4<Float>
        var translation: SIMD4<Float>
    }

    private struct Uniforms {
        var center: SIMD2<Float>
        var scale: Float
        var geometryLineCount: UInt32
        var viewportSize: SIMD2<Float>
        var padding: SIMD2<Float>
        var color: SIMD4<Float>
        var lineWidth: Float
    }

    private let device: MTLDevice
    private let commandQueue: MTLCommandQueue
    private let pipeline: MTLRenderPipelineState
    private let fillPipeline: MTLRenderPipelineState
    private let thickPipeline: MTLRenderPipelineState
    private var scene: CADScene
    private var viewport: CADViewportState
    private struct GeometryBuffer {
        let buffer: MTLBuffer
        let lineCount: Int
        let color: SIMD4<Float>
        let lineWidth: Float
    }

    private struct FillBuffer {
        let buffer: MTLBuffer
        let vertexCount: Int
        let color: SIMD4<Float>
    }

    private var rootBuffers: [GeometryBuffer] = []
    private var definitionBuffers: [Int: [GeometryBuffer]] = [:]
    private var rootFillBuffers: [FillBuffer] = []
    private var definitionFillBuffers: [Int: [FillBuffer]] = [:]
    private var hiddenLayers = Set<UInt16>()
    private var measurement: CADMeasurement?
    private var pendingMeasurementPoint: CADPoint?
    private var pathMeasurement: CADPathMeasurement?
    private var circleMeasurement: CADCircleMeasurement?
    private var snapResult: CADSnapResult?
    private var measurementTool: CADMeasurementTool = .distance
    private var measurementPoints: [CADPoint] = []
    private var areaMeasurement: CADAreaMeasurement?
    private var angleMeasurement: CADAngleMeasurement?
    private var coordinatePoint: CADPoint?
    private var selection: CADSelectionResult?
    private var markups: [CADMarkup] = []
    private var textFontMode: CADTextFontMode = .system
    private var customFontName: String?
    private var hasConfiguredDrawableSize = false
    private weak var overlayView: MTKView?
    private var annotationLayers: [String: CATextLayer] = [:]
    private var overlayUpdateScheduled = false
    private let measurementLayer = CAShapeLayer()
    private let pendingMeasurementLayer = CAShapeLayer()
    private let pendingMeasurementLabel = CATextLayer()
    private let selectionLayer = CAShapeLayer()
    private var markupLayers: [UUID: CATextLayer] = [:]

    init?(view: MTKView, scene: CADScene, viewport: CADViewportState) {
        guard let device = view.device,
              let commandQueue = device.makeCommandQueue() else { return nil }

        let shaderSource = """
        #include <metal_stdlib>
        using namespace metal;

        struct Segment { float4 points; };
        struct InstanceTransform { float4 linear; float4 translation; };
        struct Uniforms {
            float2 center;
            float scale;
            uint geometryLineCount;
            float2 viewportSize;
            float2 padding;
            float4 color;
            float lineWidth;
        };
        struct VertexOut {
            float4 position [[position]];
        };

        vertex VertexOut litecad_vertex(
            uint vertexID [[vertex_id]],
            device const Segment *segments [[buffer(0)]],
            device const InstanceTransform *instances [[buffer(1)]],
            constant Uniforms &uniforms [[buffer(2)]]) {
            uint verticesPerInstance = uniforms.geometryLineCount * 2;
            uint instanceID = vertexID / verticesPerInstance;
            uint segmentID = (vertexID / 2) % uniforms.geometryLineCount;
            bool isEnd = (vertexID & 1) == 1;
            float4 segment = segments[segmentID].points;
            float2 point = isEnd ? segment.zw : segment.xy;
            InstanceTransform instance = instances[instanceID];
            float2 world = float2(
                instance.linear.x * point.x + instance.linear.y * point.y + instance.translation.x,
                instance.linear.z * point.x + instance.linear.w * point.y + instance.translation.y
            );
            float2 ndc = float2(
                (world.x - uniforms.center.x) * uniforms.scale / (uniforms.viewportSize.x * 0.5),
                (world.y - uniforms.center.y) * uniforms.scale / (uniforms.viewportSize.y * 0.5)
            );
            return VertexOut{ float4(ndc, 0, 1) };
        }

        vertex VertexOut litecad_fill_vertex(
            uint vertexID [[vertex_id]],
            device const float2 *points [[buffer(0)]],
            device const InstanceTransform *instances [[buffer(1)]],
            constant Uniforms &uniforms [[buffer(2)]]) {
            uint instanceID = vertexID / uniforms.geometryLineCount;
            uint pointID = vertexID % uniforms.geometryLineCount;
            float2 point = points[pointID];
            InstanceTransform instance = instances[instanceID];
            float2 world = float2(
                instance.linear.x * point.x + instance.linear.y * point.y + instance.translation.x,
                instance.linear.z * point.x + instance.linear.w * point.y + instance.translation.y
            );
            float2 ndc = float2(
                (world.x - uniforms.center.x) * uniforms.scale / (uniforms.viewportSize.x * 0.5),
                (world.y - uniforms.center.y) * uniforms.scale / (uniforms.viewportSize.y * 0.5)
            );
            return VertexOut{ float4(ndc, 0, 1) };
        }

        vertex VertexOut litecad_thick_vertex(
            uint vertexID [[vertex_id]],
            device const Segment *segments [[buffer(0)]],
            device const InstanceTransform *instances [[buffer(1)]],
            constant Uniforms &uniforms [[buffer(2)]]) {
            uint verticesPerInstance = uniforms.geometryLineCount * 6;
            uint instanceID = vertexID / verticesPerInstance;
            uint localVertexID = vertexID % verticesPerInstance;
            uint segmentID = localVertexID / 6;
            uint triangleVertexID = localVertexID % 6;
            float4 segment = segments[segmentID].points;
            InstanceTransform instance = instances[instanceID];
            float2 start = float2(
                instance.linear.x * segment.x + instance.linear.y * segment.y + instance.translation.x,
                instance.linear.z * segment.x + instance.linear.w * segment.y + instance.translation.y
            );
            float2 end = float2(
                instance.linear.x * segment.z + instance.linear.y * segment.w + instance.translation.x,
                instance.linear.z * segment.z + instance.linear.w * segment.w + instance.translation.y
            );
            float2 direction = end - start;
            float directionLength = max(length(direction), 0.000001);
            float2 normal = float2(-direction.y, direction.x) / directionLength;
            float2 offset = normal * uniforms.lineWidth / max(uniforms.scale, 0.000001);
            float2 point;
            switch (triangleVertexID) {
                case 0: point = start + offset; break;
                case 1: point = end + offset; break;
                case 2: point = end - offset; break;
                case 3: point = start + offset; break;
                case 4: point = end - offset; break;
                default: point = start - offset; break;
            }
            float2 ndc = float2(
                (point.x - uniforms.center.x) * uniforms.scale / (uniforms.viewportSize.x * 0.5),
                (point.y - uniforms.center.y) * uniforms.scale / (uniforms.viewportSize.y * 0.5)
            );
            return VertexOut{ float4(ndc, 0, 1) };
        }

        fragment float4 litecad_fragment(constant Uniforms &uniforms [[buffer(2)]]) {
            return uniforms.color;
        }
        """

        guard let library = try? device.makeLibrary(source: shaderSource, options: nil),
              let vertexFunction = library.makeFunction(name: "litecad_vertex"),
              let fillVertexFunction = library.makeFunction(name: "litecad_fill_vertex"),
              let thickVertexFunction = library.makeFunction(name: "litecad_thick_vertex"),
              let fragmentFunction = library.makeFunction(name: "litecad_fragment") else {
            return nil
        }

        let descriptor = MTLRenderPipelineDescriptor()
        descriptor.vertexFunction = vertexFunction
        descriptor.fragmentFunction = fragmentFunction
        descriptor.colorAttachments[0].pixelFormat = view.colorPixelFormat

        guard let pipeline = try? device.makeRenderPipelineState(descriptor: descriptor) else {
            return nil
        }

        let fillDescriptor = MTLRenderPipelineDescriptor()
        fillDescriptor.vertexFunction = fillVertexFunction
        fillDescriptor.fragmentFunction = fragmentFunction
        fillDescriptor.colorAttachments[0].pixelFormat = view.colorPixelFormat
        fillDescriptor.colorAttachments[0].isBlendingEnabled = true
        fillDescriptor.colorAttachments[0].sourceRGBBlendFactor = .sourceAlpha
        fillDescriptor.colorAttachments[0].destinationRGBBlendFactor = .oneMinusSourceAlpha
        fillDescriptor.colorAttachments[0].sourceAlphaBlendFactor = .sourceAlpha
        fillDescriptor.colorAttachments[0].destinationAlphaBlendFactor = .oneMinusSourceAlpha
        guard let fillPipeline = try? device.makeRenderPipelineState(descriptor: fillDescriptor) else {
            return nil
        }

        let thickDescriptor = MTLRenderPipelineDescriptor()
        thickDescriptor.vertexFunction = thickVertexFunction
        thickDescriptor.fragmentFunction = fragmentFunction
        thickDescriptor.colorAttachments[0].pixelFormat = view.colorPixelFormat
        guard let thickPipeline = try? device.makeRenderPipelineState(descriptor: thickDescriptor) else {
            return nil
        }

        self.device = device
        self.commandQueue = commandQueue
        self.pipeline = pipeline
        self.fillPipeline = fillPipeline
        self.thickPipeline = thickPipeline
        self.scene = scene
        self.viewport = viewport
        self.overlayView = view
        super.init()
        measurementLayer.strokeColor = UIColor.systemYellow.cgColor
        measurementLayer.fillColor = UIColor.clear.cgColor
        measurementLayer.lineWidth = 2
        measurementLayer.lineCap = .round
        measurementLayer.lineJoin = .round
        measurementLayer.zPosition = 1_000
        pendingMeasurementLayer.strokeColor = UIColor.systemOrange.cgColor
        pendingMeasurementLayer.fillColor = UIColor.clear.cgColor
        pendingMeasurementLayer.lineWidth = 2.5
        pendingMeasurementLayer.lineCap = .round
        pendingMeasurementLayer.lineJoin = .round
        pendingMeasurementLayer.zPosition = 1_001
        pendingMeasurementLabel.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
        pendingMeasurementLabel.fontSize = 13
        pendingMeasurementLabel.foregroundColor = UIColor.systemOrange.cgColor
        pendingMeasurementLabel.backgroundColor = UIColor.black.withAlphaComponent(0.78).cgColor
        pendingMeasurementLabel.alignmentMode = .center
        pendingMeasurementLabel.cornerRadius = 5
        pendingMeasurementLabel.contentsScale = view.contentScaleFactor
        pendingMeasurementLabel.zPosition = 1_004
        selectionLayer.strokeColor = UIColor.systemGreen.cgColor
        selectionLayer.fillColor = UIColor.clear.cgColor
        selectionLayer.lineWidth = 2.5
        selectionLayer.lineDashPattern = [6, 4]
        selectionLayer.zPosition = 1_002
        view.layer.addSublayer(measurementLayer)
        view.layer.addSublayer(pendingMeasurementLayer)
        view.layer.addSublayer(pendingMeasurementLabel)
        view.layer.addSublayer(selectionLayer)
        rebuildGeometryBuffers()
    }

    func update(scene: CADScene, viewport: CADViewportState, hiddenLayers: Set<UInt16>) {
        let isNewScene = scene.rootGeometry.lineCount != self.scene.rootGeometry.lineCount
            || scene.blockDefinitions.count != self.scene.blockDefinitions.count
            || scene.blockInstances.count != self.scene.blockInstances.count
            || scene.bounds != self.scene.bounds
        let layersChanged = self.hiddenLayers != hiddenLayers
        self.scene = scene
        if isNewScene {
            self.viewport = viewport
            hasConfiguredDrawableSize = false
        }
        self.hiddenLayers = hiddenLayers
        if isNewScene || layersChanged {
            rebuildGeometryBuffers()
        }
    }

    func setHiddenLayers(_ hiddenLayers: Set<UInt16>) {
        guard self.hiddenLayers != hiddenLayers else { return }
        self.hiddenLayers = hiddenLayers
        rebuildGeometryBuffers()
    }

    func setMeasurement(_ measurement: CADMeasurement?) {
        self.measurement = measurement
        guard let view = overlayView else { return }
        scheduleAnnotationOverlayUpdate(in: view)
    }

    func setPathMeasurement(_ value: CADPathMeasurement?) {
        pathMeasurement = value
        guard let view = overlayView else { return }
        scheduleAnnotationOverlayUpdate(in: view)
    }

    func setCircleMeasurement(_ value: CADCircleMeasurement?) {
        circleMeasurement = value
        guard let view = overlayView else { return }
        scheduleAnnotationOverlayUpdate(in: view)
    }

    func setPendingMeasurementPoint(_ point: CADPoint?) {
        pendingMeasurementPoint = point
        guard let view = overlayView else { return }
        scheduleAnnotationOverlayUpdate(in: view)
    }

    func setSnapResult(_ result: CADSnapResult?) {
        snapResult = result
        guard let view = overlayView else { return }
        scheduleAnnotationOverlayUpdate(in: view)
    }

    func setMeasurementTool(_ tool: CADMeasurementTool) {
        measurementTool = tool
        guard let view = overlayView else { return }
        scheduleAnnotationOverlayUpdate(in: view)
    }

    func setMeasurementPoints(_ points: [CADPoint]) {
        measurementPoints = points
        guard let view = overlayView else { return }
        scheduleAnnotationOverlayUpdate(in: view)
    }

    func setAreaMeasurement(_ value: CADAreaMeasurement?) {
        areaMeasurement = value
        guard let view = overlayView else { return }
        scheduleAnnotationOverlayUpdate(in: view)
    }

    func setAngleMeasurement(_ value: CADAngleMeasurement?) {
        angleMeasurement = value
        guard let view = overlayView else { return }
        scheduleAnnotationOverlayUpdate(in: view)
    }

    func setCoordinatePoint(_ point: CADPoint?) {
        coordinatePoint = point
        guard let view = overlayView else { return }
        scheduleAnnotationOverlayUpdate(in: view)
    }

    func setSelection(_ value: CADSelectionResult?) {
        selection = value
        guard let view = overlayView else { return }
        scheduleAnnotationOverlayUpdate(in: view)
    }

    func setMarkups(_ values: [CADMarkup]) {
        markups = values
        guard let view = overlayView else { return }
        scheduleAnnotationOverlayUpdate(in: view)
    }

    func setTextFontMode(_ mode: CADTextFontMode) {
        textFontMode = mode
        guard let view = overlayView else { return }
        scheduleAnnotationOverlayUpdate(in: view)
    }

    func setCustomFontName(_ name: String?) {
        customFontName = name
        guard let view = overlayView else { return }
        scheduleAnnotationOverlayUpdate(in: view)
    }

    func pan(screenDeltaX: Float, screenDeltaY: Float) {
        viewport.pan(screenDeltaX: screenDeltaX, screenDeltaY: screenDeltaY)
        if let view = overlayView {
            scheduleAnnotationOverlayUpdate(in: view)
        }
    }

    func zoom(factor: Float, anchorScreenX: Float, anchorScreenY: Float) {
        viewport.zoom(factor: factor, anchorScreenX: anchorScreenX, anchorScreenY: anchorScreenY)
        if let view = overlayView {
            scheduleAnnotationOverlayUpdate(in: view)
        }
    }

    func worldPoint(in view: MTKView, point: CGPoint) -> CADPoint {
        viewport.setViewportSize(
            width: Float(max(view.drawableSize.width, 1)),
            height: Float(max(view.drawableSize.height, 1))
        )
        let screenX = Float(point.x / max(view.bounds.width, 1)) * viewport.viewportSize.x
        let screenY = Float(point.y / max(view.bounds.height, 1)) * viewport.viewportSize.y
        return viewport.worldPoint(screenX: screenX, screenY: screenY)
    }

    func snapPoint(in view: MTKView, point: CGPoint, enabled: Bool) -> CADSnapResult? {
        guard enabled else { return nil }
        let world = worldPoint(in: view, point: point)
        let tolerance = 18 / max(viewport.scale, 0.000_001)
        return scene.snapPoint(
            near: world,
            tolerance: tolerance,
            visibleBounds: viewport.visibleWorldBounds(),
            hiddenLayers: hiddenLayers
        )
    }

    func selection(in view: MTKView, point: CGPoint) -> CADSelectionResult? {
        let world = worldPoint(in: view, point: point)
        let tolerance = 24 / max(viewport.scale, 0.000_001)
        return scene.hitTest(
            near: world,
            tolerance: tolerance,
            visibleBounds: viewport.visibleWorldBounds(),
            hiddenLayers: hiddenLayers
        )
    }

    func fit() {
        viewport.fit(bounds: scene.bounds)
        if let view = overlayView {
            scheduleAnnotationOverlayUpdate(in: view)
        }
    }

    func focus(on point: CADPoint) {
        viewport.focus(on: point)
        if let view = overlayView {
            scheduleAnnotationOverlayUpdate(in: view)
        }
    }

    func snapshot() -> UIImage? {
        guard let view = overlayView else { return nil }
        let format = UIGraphicsImageRendererFormat()
        format.scale = view.window?.screen.scale ?? UIScreen.main.scale
        return UIGraphicsImageRenderer(size: view.bounds.size, format: format).image { _ in
            view.drawHierarchy(in: view.bounds, afterScreenUpdates: true)
        }
    }

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
        viewport.setViewportSize(width: Float(size.width), height: Float(size.height))
        if !hasConfiguredDrawableSize {
            viewport.fit(bounds: scene.focusBounds)
            hasConfiguredDrawableSize = true
        }
        scheduleAnnotationOverlayUpdate(in: view)
    }

    func draw(in view: MTKView) {
        guard let drawable = view.currentDrawable,
              let descriptor = view.currentRenderPassDescriptor,
              let commandBuffer = commandQueue.makeCommandBuffer(),
              let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: descriptor) else { return }

        viewport.setViewportSize(width: Float(view.drawableSize.width), height: Float(view.drawableSize.height))
        var grouped: [Int: [CADTransform2D]] = [:]
        let visibleBounds = viewport.visibleWorldBounds()
        for instance in scene.blockInstances
            where !hiddenLayers.contains(instance.layerID)
                && instance.bounds.intersects(visibleBounds) {
            collectRenderableInstances(
                definitionID: instance.definitionID,
                transform: instance.transform,
                visibleBounds: visibleBounds,
                into: &grouped,
                depth: 0
            )
        }

        encoder.setRenderPipelineState(fillPipeline)
        for rootFill in rootFillBuffers {
            drawFillBuffer(
                rootFill.buffer,
                vertexCount: rootFill.vertexCount,
                color: rootFill.color,
                instances: [CADTransform2D.identity],
                encoder: encoder
            )
        }
        for definition in scene.blockDefinitions {
            guard let transforms = grouped[definition.id],
                  !transforms.isEmpty,
                  let fillBuffers = definitionFillBuffers[definition.id] else { continue }
            for fillBuffer in fillBuffers {
                drawFillBuffer(
                    fillBuffer.buffer,
                    vertexCount: fillBuffer.vertexCount,
                    color: fillBuffer.color,
                    instances: transforms,
                    encoder: encoder
                )
            }
        }

        encoder.setRenderPipelineState(pipeline)
        for rootBuffer in rootBuffers {
            drawBuffer(
                rootBuffer.buffer,
                lineCount: rootBuffer.lineCount,
                color: rootBuffer.color,
                lineWidth: rootBuffer.lineWidth,
                instances: [CADTransform2D.identity],
                encoder: encoder
            )
        }
        for definition in scene.blockDefinitions {
            guard let transforms = grouped[definition.id],
                  !transforms.isEmpty,
                  let geometryBuffers = definitionBuffers[definition.id] else { continue }
            for geometryBuffer in geometryBuffers {
                drawBuffer(
                    geometryBuffer.buffer,
                    lineCount: geometryBuffer.lineCount,
                    color: geometryBuffer.color,
                    lineWidth: geometryBuffer.lineWidth,
                    instances: transforms,
                    encoder: encoder
                )
            }
        }

        encoder.endEncoding()
        commandBuffer.present(drawable)
        commandBuffer.commit()
        scheduleAnnotationOverlayUpdate(in: view)
    }

    private func scheduleAnnotationOverlayUpdate(in view: MTKView) {
        guard !overlayUpdateScheduled else { return }
        overlayUpdateScheduled = true
        DispatchQueue.main.async { [weak self, weak view] in
            guard let self, let view else { return }
            self.overlayUpdateScheduled = false
            self.updateAnnotationOverlays(in: view)
        }
    }

    private func updateAnnotationOverlays(in view: MTKView) {
        viewport.setViewportSize(
            width: Float(max(view.drawableSize.width, 1)),
            height: Float(max(view.drawableSize.height, 1))
        )
        let drawableWidth = max(CGFloat(view.drawableSize.width), 1)
        let drawableHeight = max(CGFloat(view.drawableSize.height), 1)
        let pixelToPointX = view.bounds.width / drawableWidth
        let pixelToPointY = view.bounds.height / drawableHeight
        let minimumWorldTextHeight = Float(
            6 / max(CGFloat(viewport.scale) * pixelToPointY, 0.000_001)
        )
        let visibleBounds = viewport.visibleWorldBounds()
        var annotations: [(key: String, value: CADTextAnnotation)] = []
        for (index, annotation) in scene.rootAnnotations.enumerated()
            where !hiddenLayers.contains(annotation.layerID)
                && annotation.height >= minimumWorldTextHeight
                && visibleBounds.intersects(annotation.bounds) {
            annotations.append(("root-\(index)", annotation))
        }
        for (instanceIndex, instance) in scene.blockInstances.enumerated()
            where !hiddenLayers.contains(instance.layerID)
                && instance.bounds.intersects(visibleBounds) {
            appendRenderableAnnotations(
                definitionID: instance.definitionID,
                transform: instance.transform,
                keyPrefix: "block-\(instanceIndex)",
                visibleBounds: visibleBounds,
                into: &annotations,
                depth: 0,
                minimumTextHeight: minimumWorldTextHeight
            )
        }

        var renderedAnnotations: [(String, CADTextAnnotation, CGFloat, CGFloat, CGFloat, String)] = []
        for item in annotations {
            let annotation = item.value
            let worldOffsetX = CGFloat(annotation.position.x - viewport.center.x)
                * CGFloat(viewport.scale)
            let worldOffsetY = CGFloat(annotation.position.y - viewport.center.y)
                * CGFloat(viewport.scale)
            let screenX = worldOffsetX * pixelToPointX + view.bounds.width / 2
            let screenY = view.bounds.height / 2 - worldOffsetY * pixelToPointY
            let fontSize = CGFloat(annotation.height * viewport.scale) * pixelToPointY
            guard fontSize >= 6, fontSize.isFinite else { continue }
            renderedAnnotations.append((
                item.key,
                annotation,
                screenX,
                screenY,
                min(max(fontSize, 8), 96),
                normalizedText(annotation.text)
            ))
        }

        CATransaction.begin()
        CATransaction.setDisableActions(true)
        defer { CATransaction.commit() }

        for (_, item) in renderedAnnotations.enumerated() {
            let key = item.0
            let annotation = item.1
            let layer = annotationLayers[key] ?? CATextLayer()
            if annotationLayers[key] == nil {
                annotationLayers[key] = layer
                view.layer.addSublayer(layer)
            }
            layer.removeAllAnimations()

            let screenX = item.2
            let screenY = item.3
            let fontSize = item.4
            let displayText = item.5
            let font = annotationFont(ofSize: fontSize)
            let measuredText = (displayText as NSString).boundingRect(
                with: CGSize(width: 32_000, height: 32_000),
                options: [.usesLineFragmentOrigin, .usesFontLeading],
                attributes: [.font: font],
                context: nil
            )
            let lineCount = CGFloat(max(displayText.reduce(into: 1) { count, character in
                if character == "\n" { count += 1 }
            }, 1))
            let width = max(measuredText.width + 4, fontSize)
            let height = max(measuredText.height + 4, fontSize * 1.25 * lineCount)

            layer.string = displayText
            layer.font = font
            layer.fontSize = fontSize
            layer.alignmentMode = .left
            layer.isWrapped = true
            layer.truncationMode = .none
            layer.foregroundColor = annotation.kind == .dimension
                ? UIColor.systemYellow.cgColor
                : UIColor.white.cgColor
            layer.contentsScale = view.contentScaleFactor
            layer.isHidden = false
            layer.anchorPoint = textAnchor(for: annotation)
            layer.bounds = CGRect(x: 0, y: 0, width: width, height: height)
            layer.position = CGPoint(x: screenX, y: screenY)
            var transform = CATransform3DMakeRotation(-CGFloat(annotation.rotation), 0, 0, 1)
            transform = CATransform3DScale(
                transform,
                CGFloat(min(max(annotation.widthFactor, 0.1), 10)),
                1,
                1
            )
            layer.transform = transform
        }
        let visibleKeys = Set(renderedAnnotations.map(\.0))
        for (key, layer) in annotationLayers {
            layer.isHidden = !visibleKeys.contains(key)
        }
        updateMeasurementOverlay(in: view)
    }

    private func textAnchor(for annotation: CADTextAnnotation) -> CGPoint {
        if annotation.kind == .mtext {
            switch annotation.attachment {
            case 2: return CGPoint(x: 0.5, y: 0)
            case 3: return CGPoint(x: 1, y: 0)
            case 4: return CGPoint(x: 0, y: 0.5)
            case 5: return CGPoint(x: 0.5, y: 0.5)
            case 6: return CGPoint(x: 1, y: 0.5)
            case 7: return CGPoint(x: 0, y: 1)
            case 8: return CGPoint(x: 0.5, y: 1)
            case 9: return CGPoint(x: 1, y: 1)
            default: return CGPoint(x: 0, y: 0)
            }
        }

        let horizontal: CGFloat
        switch annotation.horizontalAlignment {
        case 1, 4: horizontal = 0.5
        case 2: horizontal = 1
        default: horizontal = 0
        }
        let vertical: CGFloat
        switch annotation.verticalAlignment {
        case 2: vertical = 0.5
        case 3: vertical = 0
        default: vertical = 1
        }
        return CGPoint(x: horizontal, y: vertical)
    }

    private func appendRenderableAnnotations(
        definitionID: Int,
        transform: CADTransform2D,
        keyPrefix: String,
        visibleBounds: CADRect,
        into annotations: inout [(key: String, value: CADTextAnnotation)],
        depth: Int,
        minimumTextHeight: Float
    ) {
        guard depth < 64,
              scene.blockDefinitions.indices.contains(definitionID) else { return }
        let definition = scene.blockDefinitions[definitionID]
        for (annotationIndex, annotation) in definition.annotations.enumerated() {
            let transformed = annotation.transformed(by: transform)
            guard !hiddenLayers.contains(transformed.layerID),
                  transformed.height >= minimumTextHeight,
                  visibleBounds.intersects(transformed.bounds) else { continue }
            annotations.append((
                "\(keyPrefix)-d\(definitionID)-a\(annotationIndex)",
                transformed
            ))
        }
        for (nestedIndex, nested) in definition.nestedInstances.enumerated()
            where !hiddenLayers.contains(nested.layerID) {
            guard scene.blockDefinitions.indices.contains(nested.definitionID) else { continue }
            let combined = transform.concatenating(nested.transform)
            let childDefinition = scene.blockDefinitions[nested.definitionID]
            guard childDefinition.bounds.transformed(by: combined).intersects(visibleBounds) else {
                continue
            }
            appendRenderableAnnotations(
                definitionID: nested.definitionID,
                transform: combined,
                keyPrefix: "\(keyPrefix)-n\(nestedIndex)",
                visibleBounds: visibleBounds,
                into: &annotations,
                depth: depth + 1,
                minimumTextHeight: minimumTextHeight
            )
        }
    }

    private func updateMeasurementOverlay(in view: MTKView) {
        measurementLayer.frame = view.bounds
        pendingMeasurementLayer.frame = view.bounds
        measurementLayer.path = nil
        pendingMeasurementLayer.path = nil

        let drawableWidth = max(CGFloat(view.drawableSize.width), 1)
        let drawableHeight = max(CGFloat(view.drawableSize.height), 1)
        let pixelToPointX = view.bounds.width / drawableWidth
        let pixelToPointY = view.bounds.height / drawableHeight
        func screenPoint(_ point: CADPoint) -> CGPoint {
            CGPoint(
                x: CGFloat((point.x - viewport.center.x) * viewport.scale) * pixelToPointX
                    + view.bounds.width / 2,
                y: view.bounds.height / 2
                    - CGFloat((point.y - viewport.center.y) * viewport.scale) * pixelToPointY
            )
        }

        if let measurement {
            let start = screenPoint(measurement.start)
            let end = screenPoint(measurement.end)
            let path = CGMutablePath()
            path.move(to: start)
            path.addLine(to: end)
            path.addEllipse(in: CGRect(x: start.x - 6, y: start.y - 6, width: 12, height: 12))
            path.addEllipse(in: CGRect(x: end.x - 6, y: end.y - 6, width: 12, height: 12))
            measurementLayer.path = path
        }

        if let pathMeasurement, pathMeasurement.points.count >= 2 {
            let path = CGMutablePath()
            path.move(to: screenPoint(pathMeasurement.points[0]))
            for point in pathMeasurement.points.dropFirst() {
                path.addLine(to: screenPoint(point))
            }
            measurementLayer.strokeColor = UIColor.systemMint.cgColor
            measurementLayer.path = path
        }

        if measurementTool == .circle && measurementPoints.count >= 2 {
            let path = CGMutablePath()
            path.move(to: screenPoint(measurementPoints[0]))
            for point in measurementPoints.dropFirst() { path.addLine(to: screenPoint(point)) }
            measurementLayer.strokeColor = UIColor.systemMint.cgColor
            measurementLayer.path = path
        }
        if let circleMeasurement {
            let center = screenPoint(circleMeasurement.center)
            let radius = CGFloat(circleMeasurement.radius * viewport.scale)
            measurementLayer.strokeColor = UIColor.systemYellow.cgColor
            measurementLayer.fillColor = UIColor.systemYellow.withAlphaComponent(0.08).cgColor
            measurementLayer.path = CGPath(
                ellipseIn: CGRect(
                    x: center.x - radius,
                    y: center.y - radius,
                    width: radius * 2,
                    height: radius * 2
                ),
                transform: nil
            )
        }

        if let pendingMeasurementPoint {
            let point = screenPoint(pendingMeasurementPoint)
            let path = CGMutablePath()
            if snapResult != nil {
                path.addRect(CGRect(x: point.x - 8, y: point.y - 8, width: 16, height: 16))
            } else {
                path.addEllipse(in: CGRect(x: point.x - 8, y: point.y - 8, width: 16, height: 16))
            }
            path.move(to: CGPoint(x: point.x - 13, y: point.y))
            path.addLine(to: CGPoint(x: point.x + 13, y: point.y))
            path.move(to: CGPoint(x: point.x, y: point.y - 13))
            path.addLine(to: CGPoint(x: point.x, y: point.y + 13))
            pendingMeasurementLayer.strokeColor = snapResult == nil
                ? UIColor.systemOrange.cgColor
                : UIColor.systemGreen.cgColor
            pendingMeasurementLayer.path = path
            pendingMeasurementLabel.string = measurementTool == .continuousDistance
                ? "路径点 (measurementPoints.count)"
                : "第 1 点"
            pendingMeasurementLabel.bounds = CGRect(x: 0, y: 0, width: 82, height: 26)
            pendingMeasurementLabel.position = CGPoint(x: point.x + 48, y: point.y - 24)
            pendingMeasurementLabel.isHidden = false
        } else {
            pendingMeasurementLabel.isHidden = true
        }

        if measurementTool == .area && measurementPoints.count >= 2 {
            let path = CGMutablePath()
            path.move(to: screenPoint(measurementPoints[0]))
            for point in measurementPoints.dropFirst() { path.addLine(to: screenPoint(point)) }
            measurementLayer.strokeColor = UIColor.systemMint.cgColor
            measurementLayer.path = path
        }
        if let areaMeasurement, areaMeasurement.points.count >= 3 {
            let path = CGMutablePath()
            path.move(to: screenPoint(areaMeasurement.points[0]))
            for point in areaMeasurement.points.dropFirst() { path.addLine(to: screenPoint(point)) }
            path.closeSubpath()
            measurementLayer.strokeColor = UIColor.systemMint.cgColor
            measurementLayer.fillColor = UIColor.systemMint.withAlphaComponent(0.12).cgColor
            measurementLayer.path = path
        } else {
            measurementLayer.fillColor = UIColor.clear.cgColor
        }
        if let angleMeasurement {
            let path = CGMutablePath()
            path.move(to: screenPoint(angleMeasurement.start))
            path.addLine(to: screenPoint(angleMeasurement.vertex))
            path.addLine(to: screenPoint(angleMeasurement.end))
            measurementLayer.strokeColor = UIColor.systemPink.cgColor
            measurementLayer.path = path
        }
        if let coordinatePoint {
            let point = screenPoint(coordinatePoint)
            let path = CGMutablePath()
            path.addEllipse(in: CGRect(x: point.x - 7, y: point.y - 7, width: 14, height: 14))
            path.move(to: CGPoint(x: point.x - 14, y: point.y))
            path.addLine(to: CGPoint(x: point.x + 14, y: point.y))
            path.move(to: CGPoint(x: point.x, y: point.y - 14))
            path.addLine(to: CGPoint(x: point.x, y: point.y + 14))
            pendingMeasurementLayer.strokeColor = UIColor.systemCyan.cgColor
            pendingMeasurementLayer.path = path
        }

        selectionLayer.frame = view.bounds
        selectionLayer.path = nil
        if let selection {
            let point = screenPoint(selection.point)
            selectionLayer.path = CGPath(ellipseIn: CGRect(x: point.x - 11, y: point.y - 11, width: 22, height: 22), transform: nil)
        }
        let visibleMarkupIDs = Set(markups.map(\.id))
        for markup in markups {
            let layer = markupLayers[markup.id] ?? CATextLayer()
            if markupLayers[markup.id] == nil {
                markupLayers[markup.id] = layer
                view.layer.addSublayer(layer)
            }
            let point = screenPoint(markup.point)
            layer.string = "📌 \(markup.text)"
            layer.font = UIFont.systemFont(ofSize: 12, weight: .medium)
            layer.fontSize = 12
            layer.foregroundColor = UIColor.systemOrange.cgColor
            layer.backgroundColor = UIColor.black.withAlphaComponent(0.75).cgColor
            layer.cornerRadius = 5
            layer.contentsScale = view.contentScaleFactor
            layer.bounds = CGRect(x: 0, y: 0, width: 180, height: 24)
            layer.position = CGPoint(x: point.x + 8, y: point.y - 8)
            layer.isHidden = false
        }
        for (id, layer) in markupLayers { layer.isHidden = !visibleMarkupIDs.contains(id) }
    }

    private func normalizedText(_ text: String) -> String {
        var value = text
            .replacingOccurrences(of: "\\P", with: "\n")
            .replacingOccurrences(of: "\\~", with: " ")
            .replacingOccurrences(of: "\\\\", with: "\\")
            .replacingOccurrences(of: "{", with: "")
            .replacingOccurrences(of: "}", with: "")
            .replacingOccurrences(of: "%%d", with: "°")
            .replacingOccurrences(of: "%%p", with: "±")
            .replacingOccurrences(of: "%%c", with: "Ø")

        value = decodeUnicodeEscapes(in: value)

        value = value.replacingOccurrences(
            of: #"\\S([^;]*?)([\^#/])([^;]*);"#,
            with: "$1/$3",
            options: .regularExpression
        )
        for pattern in [
            #"\\[HhWwTtCcAaFfPp][^;]*;"#,
            #"\\[LlOoKk]"#,
            #"\\S[^;]*;"#
        ] {
            value = value.replacingOccurrences(
                of: pattern,
                with: "",
                options: .regularExpression
            )
        }
        return value
    }

    private func decodeUnicodeEscapes(in text: String) -> String {
        let pattern = #"\\U\+([0-9A-Fa-f]{4,6})"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return text }
        let fullRange = NSRange(text.startIndex..<text.endIndex, in: text)
        var value = text
        for match in regex.matches(in: text, range: fullRange).reversed() {
            guard let codeRange = Range(match.range(at: 1), in: text),
                  let scalarValue = UInt32(text[codeRange], radix: 16),
                  let scalar = UnicodeScalar(scalarValue),
                  let replacementRange = Range(match.range, in: value) else { continue }
            value.replaceSubrange(replacementRange, with: String(scalar))
        }
        return value
    }

    private func annotationFont(ofSize size: CGFloat) -> UIFont {
        if textFontMode == .imported,
           let customFontName,
           let imported = UIFont(name: customFontName, size: size) {
            return imported
        }
        if textFontMode == .engineering {
            return UIFont.monospacedSystemFont(ofSize: size, weight: .regular)
        }
        return UIFont.systemFont(ofSize: size)
    }

    private func rebuildGeometryBuffers() {
        rootBuffers = makeBuffers(for: scene.rootGeometry)
        definitionBuffers = Dictionary(uniqueKeysWithValues: scene.blockDefinitions.map { definition in
            (definition.id, makeBuffers(for: definition.geometry))
        })
        rootFillBuffers = makeFillBuffers(for: scene.rootFills)
        definitionFillBuffers = Dictionary(uniqueKeysWithValues: scene.blockDefinitions.map { definition in
            (definition.id, makeFillBuffers(for: definition.fills))
        })
    }

    private func collectRenderableInstances(
        definitionID: Int,
        transform: CADTransform2D,
        visibleBounds: CADRect,
        into grouped: inout [Int: [CADTransform2D]],
        depth: Int
    ) {
        guard depth < 64,
              scene.blockDefinitions.indices.contains(definitionID) else { return }
        let definition = scene.blockDefinitions[definitionID]
        if !definition.geometry.isEmpty || !definition.fills.isEmpty {
            grouped[definitionID, default: []].append(transform)
        }
        for nested in definition.nestedInstances where !hiddenLayers.contains(nested.layerID) {
            guard scene.blockDefinitions.indices.contains(nested.definitionID) else { continue }
            let childDefinition = scene.blockDefinitions[nested.definitionID]
            let combined = transform.concatenating(nested.transform)
            guard childDefinition.bounds.transformed(by: combined).intersects(visibleBounds) else {
                continue
            }
            collectRenderableInstances(
                definitionID: nested.definitionID,
                transform: combined,
                visibleBounds: visibleBounds,
                into: &grouped,
                depth: depth + 1
            )
        }
    }

    private func makeBuffers(for geometry: CADLineBuffer) -> [GeometryBuffer] {
        guard !geometry.isEmpty else { return [] }
        var grouped: [ColorKey: [Segment]] = [:]
        var colorOrder: [ColorKey] = []
        grouped.reserveCapacity(min(geometry.lineCount, 32))
        colorOrder.reserveCapacity(min(geometry.lineCount, 32))
        for index in 0..<geometry.lineCount {
            guard let segment = geometry.segment(at: index) else { continue }
            guard !hiddenLayers.contains(segment.layerID) else { continue }
            let layer = scene.layers.first { $0.id == segment.layerID }
            let rgb = segment.colorRGB == 0 ? (layer?.colorRGB ?? 0) : segment.colorRGB
            let aci = segment.colorIndex == 0 ? (layer?.colorIndex ?? 0) : segment.colorIndex
            let lineWeight = layer?.lineWeight ?? 0
            let linePattern = layer?.linePattern ?? .solid
            let key = ColorKey(
                rgb: rgb,
                aci: aci,
                lineWeight: lineWeight,
                linePattern: linePattern
            )
            if grouped[key] == nil {
                colorOrder.append(key)
                grouped[key] = []
            }
            grouped[key, default: []].append(contentsOf: styledSegments(
                start: segment.start,
                end: segment.end,
                pattern: linePattern
            ))
        }
        return colorOrder.compactMap { key in
            guard let segments = grouped[key], !segments.isEmpty else { return nil }
            return segments.withUnsafeBytes { rawBuffer -> GeometryBuffer? in
                guard let baseAddress = rawBuffer.baseAddress,
                      let buffer = device.makeBuffer(bytes: baseAddress, length: rawBuffer.count, options: .storageModeShared) else {
                    return nil
                }
                return GeometryBuffer(
                    buffer: buffer,
                    lineCount: segments.count,
                    color: renderColor(rgb: key.rgb, aci: key.aci),
                    lineWidth: lineWidth(for: key.lineWeight)
                )
            }
        }
    }

    private func styledSegments(
        start: CADPoint,
        end: CADPoint,
        pattern: CADLinePattern
    ) -> [Segment] {
        let dx = end.x - start.x
        let dy = end.y - start.y
        let length = hypot(dx, dy)
        guard length.isFinite, length > 0.000_001 else { return [] }
        guard pattern != .solid else {
            return [Segment(points: SIMD4(start.x, start.y, end.x, end.y))]
        }

        // LibreDWG exposes the layer's linetype name here, but not the full
        // linetype dash definition. Keep the visual rhythm stable per source
        // segment until a future bridge revision carries exact dash lengths.
        let unit = max(length / 10, 0.25)
        let patternUnits: [Float]
        switch pattern {
        case .dashed:
            patternUnits = [4, 2]
        case .dotted:
            patternUnits = [0.6, 1.8]
        case .center:
            patternUnits = [5, 2, 0.8, 2]
        case .solid:
            patternUnits = [1]
        }

        var result: [Segment] = []
        var distance: Float = 0
        var patternIndex = 0
        var remaining = patternUnits[0] * unit
        var draw = true
        while distance < length - 0.000_001 {
            let next = min(length, distance + remaining)
            if draw, next > distance {
                let startRatio = distance / length
                let endRatio = next / length
                result.append(Segment(points: SIMD4(
                    start.x + dx * startRatio,
                    start.y + dy * startRatio,
                    start.x + dx * endRatio,
                    start.y + dy * endRatio
                )))
            }
            distance = next
            patternIndex = (patternIndex + 1) % patternUnits.count
            remaining = patternUnits[patternIndex] * unit
            draw.toggle()
        }
        return result
    }

    private func lineWidth(for lineWeight: UInt16) -> Float {
        guard lineWeight > 0 else { return 0 }
        // DWG lineweight is stored in hundredths of a millimetre. Map it to a
        // restrained screen-space half width; the shader converts it to world
        // units so zooming does not make a thick line disappear.
        return min(max(0.75 + Float(lineWeight) / 160, 0.75), 3.5)
    }

    private func makeFillBuffers(for fills: [CADFillPolygon]) -> [FillBuffer] {
        var buffers: [FillBuffer] = []
        buffers.reserveCapacity(fills.count)
        for fill in fills where !fill.isHole
            && fill.points.count >= 3
            && !hiddenLayers.contains(fill.layerID) {
            let layer = scene.layers.first { $0.id == fill.layerID }
            let rgb = fill.colorRGB == 0 ? (layer?.colorRGB ?? 0) : fill.colorRGB
            let aci = fill.colorIndex == 0 ? (layer?.colorIndex ?? 0) : fill.colorIndex
            var points: [SIMD2<Float>] = []
            points.reserveCapacity((fill.points.count - 2) * 3)
            for index in 1..<(fill.points.count - 1) {
                let p0 = fill.points[0]
                let p1 = fill.points[index]
                let p2 = fill.points[index + 1]
                points.append(SIMD2(p0.x, p0.y))
                points.append(SIMD2(p1.x, p1.y))
                points.append(SIMD2(p2.x, p2.y))
            }
            guard !points.isEmpty,
                  let buffer = points.withUnsafeBytes({ (rawBuffer: UnsafeRawBufferPointer) -> MTLBuffer? in
                      guard let baseAddress = rawBuffer.baseAddress else { return nil }
                      return device.makeBuffer(
                          bytes: baseAddress,
                          length: rawBuffer.count,
                          options: .storageModeShared
                      )
                  }) else { continue }
            var color = renderColor(rgb: rgb, aci: aci)
            color.w = 0.22
            buffers.append(FillBuffer(buffer: buffer, vertexCount: points.count, color: color))
        }
        return buffers
    }

    private func renderColor(rgb: UInt32, aci: UInt16) -> SIMD4<Float> {
        if rgb != 0 {
            let color = SIMD4(
                Float((rgb >> 16) & 0xff) / 255,
                Float((rgb >> 8) & 0xff) / 255,
                Float(rgb & 0xff) / 255,
                1
            )
            return ensureCanvasContrast(color)
        }
        let standard: SIMD4<Float>
        switch aci {
        case 1: standard = SIMD4(1, 0.15, 0.15, 1)
        case 2: standard = SIMD4(1, 0.85, 0.1, 1)
        case 3: standard = SIMD4(0.2, 0.9, 0.35, 1)
        case 4: standard = SIMD4(0.2, 0.9, 0.95, 1)
        case 5: standard = SIMD4(0.25, 0.45, 1, 1)
        case 6: standard = SIMD4(0.95, 0.3, 0.95, 1)
        case 7: standard = SIMD4(0.95, 0.95, 0.98, 1)
        case 8, 9: standard = SIMD4(0.55, 0.58, 0.64, 1)
        default: standard = SIMD4(0.35, 0.82, 1, 1)
        }
        return standard
    }

    private func ensureCanvasContrast(_ color: SIMD4<Float>) -> SIMD4<Float> {
        let peak = max(color.x, max(color.y, color.z))
        guard peak > 0.001, peak < 0.5 else { return color }
        let scale = min(0.68 / peak, 1 / peak)
        return SIMD4(
            min(color.x * scale, 1),
            min(color.y * scale, 1),
            min(color.z * scale, 1),
            color.w
        )
    }

    private func drawBuffer(
        _ geometryBuffer: MTLBuffer,
        lineCount: Int,
        color: SIMD4<Float>,
        lineWidth: Float,
        instances: [CADTransform2D],
        encoder: MTLRenderCommandEncoder
    ) {
        let gpuInstances = instances.map {
            InstanceTransform(
                linear: SIMD4($0.a, $0.c, $0.b, $0.d),
                translation: SIMD4($0.tx, $0.ty, 0, 0)
            )
        }
        guard let instanceBuffer = gpuInstances.withUnsafeBytes({ (rawBuffer: UnsafeRawBufferPointer) -> MTLBuffer? in
            guard let baseAddress = rawBuffer.baseAddress else { return nil }
            return device.makeBuffer(bytes: baseAddress, length: rawBuffer.count, options: .storageModeShared)
        }) else { return }

        var uniforms = Uniforms(
            center: SIMD2(viewport.center.x, viewport.center.y),
            scale: viewport.scale,
            geometryLineCount: UInt32(lineCount),
            viewportSize: SIMD2(viewport.viewportSize.x, viewport.viewportSize.y),
            padding: .zero,
            color: color,
            lineWidth: lineWidth
        )
        guard let uniformBuffer = device.makeBuffer(bytes: &uniforms, length: MemoryLayout<Uniforms>.stride, options: .storageModeShared) else { return }

        encoder.setRenderPipelineState(lineWidth > 0 ? thickPipeline : pipeline)
        encoder.setVertexBuffer(geometryBuffer, offset: 0, index: 0)
        encoder.setVertexBuffer(instanceBuffer, offset: 0, index: 1)
        encoder.setVertexBuffer(uniformBuffer, offset: 0, index: 2)
        encoder.setFragmentBuffer(uniformBuffer, offset: 0, index: 2)
        encoder.drawPrimitives(
            type: lineWidth > 0 ? .triangle : .line,
            vertexStart: 0,
            vertexCount: lineCount * (lineWidth > 0 ? 6 : 2) * instances.count
        )
    }

    private func drawFillBuffer(
        _ fillBuffer: MTLBuffer,
        vertexCount: Int,
        color: SIMD4<Float>,
        instances: [CADTransform2D],
        encoder: MTLRenderCommandEncoder
    ) {
        let gpuInstances = instances.map {
            InstanceTransform(
                linear: SIMD4($0.a, $0.c, $0.b, $0.d),
                translation: SIMD4($0.tx, $0.ty, 0, 0)
            )
        }
        guard let instanceBuffer = gpuInstances.withUnsafeBytes({ (rawBuffer: UnsafeRawBufferPointer) -> MTLBuffer? in
            guard let baseAddress = rawBuffer.baseAddress else { return nil }
            return device.makeBuffer(bytes: baseAddress, length: rawBuffer.count, options: .storageModeShared)
        }) else { return }

        var uniforms = Uniforms(
            center: SIMD2(viewport.center.x, viewport.center.y),
            scale: viewport.scale,
            geometryLineCount: UInt32(vertexCount),
            viewportSize: SIMD2(viewport.viewportSize.x, viewport.viewportSize.y),
            padding: .zero,
            color: color,
            lineWidth: 0
        )
        guard let uniformBuffer = device.makeBuffer(
            bytes: &uniforms,
            length: MemoryLayout<Uniforms>.stride,
            options: .storageModeShared
        ) else { return }

        encoder.setRenderPipelineState(fillPipeline)
        encoder.setVertexBuffer(fillBuffer, offset: 0, index: 0)
        encoder.setVertexBuffer(instanceBuffer, offset: 0, index: 1)
        encoder.setVertexBuffer(uniformBuffer, offset: 0, index: 2)
        encoder.setFragmentBuffer(uniformBuffer, offset: 0, index: 2)
        encoder.drawPrimitives(
            type: .triangle,
            vertexStart: 0,
            vertexCount: vertexCount * instances.count
        )
    }
}
#endif
