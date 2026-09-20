import Foundation

public struct CADEditHistory: Equatable, Sendable {
    private var undoStack: [CADScene] = []
    private var redoStack: [CADScene] = []

    public init() {}

    public var canUndo: Bool { !undoStack.isEmpty }
    public var canRedo: Bool { !redoStack.isEmpty }

    public mutating func record(before scene: CADScene) {
        undoStack.append(scene)
        redoStack.removeAll(keepingCapacity: true)
    }

    public mutating func undo(current scene: CADScene) -> CADScene? {
        guard let previous = undoStack.popLast() else { return nil }
        redoStack.append(scene)
        return previous
    }

    public mutating func redo(current scene: CADScene) -> CADScene? {
        guard let next = redoStack.popLast() else { return nil }
        undoStack.append(scene)
        return next
    }

    public mutating func removeAll() {
        undoStack.removeAll(keepingCapacity: true)
        redoStack.removeAll(keepingCapacity: true)
    }
}

public struct CADSelectionDescriptor: Codable, Equatable, Sendable {
    public let kind: CADSelectionKind
    public let pointX: Float
    public let pointY: Float
    public let distance: Float
    public let layerID: UInt16
    public let lineIndex: Int?
    public let annotationIndex: Int?
    public let fillIndex: Int?
    public let definitionID: Int?
    public let instanceIndex: Int?
    public let rootSegment: CADLineSegment?
    public let rootAnnotation: CADTextAnnotation?
    public let rootFill: CADFillPolygon?
    public let instanceTransform: CADTransform2D?

    public init(selection: CADSelectionResult, in scene: CADScene? = nil) {
        self.kind = selection.kind
        self.pointX = selection.point.x
        self.pointY = selection.point.y
        self.distance = selection.distance
        self.layerID = selection.layerID
        self.lineIndex = selection.lineIndex
        self.annotationIndex = selection.annotationIndex
        self.fillIndex = selection.fillIndex
        self.definitionID = selection.definitionID
        self.instanceIndex = selection.instanceIndex
        self.rootSegment = selection.instanceIndex == nil
            ? selection.lineIndex.flatMap { scene?.rootGeometry.segment(at: $0) }
            : nil
        self.rootAnnotation = selection.instanceIndex == nil
            ? selection.annotationIndex.flatMap { scene?.rootAnnotations[safe: $0] }
            : nil
        self.rootFill = selection.instanceIndex == nil
            ? selection.fillIndex.flatMap { scene?.rootFills[safe: $0] }
            : nil
        self.instanceTransform = selection.instanceIndex.flatMap { index in
            scene?.blockInstances.indices.contains(index) == true
                ? scene?.blockInstances[index].transform
                : nil
        }
    }

    public func resolved() -> CADSelectionResult {
        CADSelectionResult(
            kind: kind,
            point: CADPoint(x: pointX, y: pointY),
            distance: distance,
            layerID: layerID,
            lineIndex: lineIndex,
            annotationIndex: annotationIndex,
            fillIndex: fillIndex,
            definitionID: definitionID,
            instanceIndex: instanceIndex
        )
    }

    public func resolved(in scene: CADScene) -> CADSelectionResult? {
        if let instanceIndex {
            let resolvedIndex = scene.blockInstances.indices.contains(instanceIndex)
                && matchesInstance(scene.blockInstances[instanceIndex])
                ? instanceIndex
                : scene.blockInstances.firstIndex(where: matchesInstance)
            guard let resolvedIndex else { return nil }
            return CADSelectionResult(
                kind: kind,
                point: CADPoint(x: pointX, y: pointY),
                distance: distance,
                layerID: layerID,
                lineIndex: lineIndex,
                definitionID: definitionID,
                instanceIndex: resolvedIndex
            )
        }

        if let annotationIndex {
            var resolvedIndex: Int?
            if scene.rootAnnotations.indices.contains(annotationIndex),
               matchesRootAnnotation(scene.rootAnnotations[annotationIndex]) {
                resolvedIndex = annotationIndex
            } else {
                resolvedIndex = scene.rootAnnotations.firstIndex(where: matchesRootAnnotation)
            }
            guard let resolvedIndex else { return nil }
            return CADSelectionResult(
                kind: .text,
                point: CADPoint(x: pointX, y: pointY),
                distance: distance,
                layerID: layerID,
                annotationIndex: resolvedIndex,
                text: rootAnnotation?.text
            )
        }

        if let fillIndex {
            var resolvedIndex: Int?
            if scene.rootFills.indices.contains(fillIndex), matchesRootFill(scene.rootFills[fillIndex]) {
                resolvedIndex = fillIndex
            } else {
                resolvedIndex = scene.rootFills.firstIndex(where: matchesRootFill)
            }
            guard let resolvedIndex else { return nil }
            return CADSelectionResult(
                kind: .fill,
                point: CADPoint(x: pointX, y: pointY),
                distance: distance,
                layerID: layerID,
                fillIndex: resolvedIndex
            )
        }

        guard let lineIndex else { return resolved() }
        var resolvedIndex: Int?
        if let segment = scene.rootGeometry.segment(at: lineIndex), matchesRootSegment(segment) {
            resolvedIndex = lineIndex
        } else {
            resolvedIndex = scene.rootGeometry.firstIndex(where: matchesRootSegment)
        }
        guard let resolvedIndex else { return nil }
        return CADSelectionResult(
            kind: kind,
            point: CADPoint(x: pointX, y: pointY),
            distance: distance,
            layerID: layerID,
            lineIndex: resolvedIndex,
            definitionID: definitionID,
            instanceIndex: nil
        )
    }

    private func matchesRootSegment(_ segment: CADLineSegment) -> Bool {
        guard segment.layerID == layerID else { return false }
        guard let rootSegment else { return lineIndex != nil }
        return rootSegment.start.isApproximatelyEqual(to: segment.start)
            && rootSegment.end.isApproximatelyEqual(to: segment.end)
            || rootSegment.start.isApproximatelyEqual(to: segment.end)
                && rootSegment.end.isApproximatelyEqual(to: segment.start)
    }

    private func matchesInstance(_ instance: CADBlockInstance) -> Bool {
        guard instance.definitionID == definitionID else { return false }
        guard let instanceTransform else { return true }
        return instance.transform.isApproximatelyEqual(to: instanceTransform)
    }

    private func matchesRootAnnotation(_ annotation: CADTextAnnotation) -> Bool {
        guard annotation.layerID == layerID else { return false }
        guard let rootAnnotation else { return annotationIndex != nil }
        return annotation == rootAnnotation
    }

    private func matchesRootFill(_ fill: CADFillPolygon) -> Bool {
        guard fill.layerID == layerID else { return false }
        guard let rootFill else { return fillIndex != nil }
        return fill == rootFill
    }
}

private extension CADPoint {
    func isApproximatelyEqual(to other: CADPoint, tolerance: Float = 0.001) -> Bool {
        abs(x - other.x) <= tolerance && abs(y - other.y) <= tolerance
    }
}

private extension CADTransform2D {
    func isApproximatelyEqual(to other: CADTransform2D, tolerance: Float = 0.001) -> Bool {
        abs(a - other.a) <= tolerance
            && abs(b - other.b) <= tolerance
            && abs(c - other.c) <= tolerance
            && abs(d - other.d) <= tolerance
            && abs(tx - other.tx) <= tolerance
            && abs(ty - other.ty) <= tolerance
    }
}

private extension CADLineBuffer {
    func firstIndex(where predicate: (CADLineSegment) -> Bool) -> Int? {
        for index in 0..<lineCount {
            guard let segment = segment(at: index) else { continue }
            if predicate(segment) { return index }
        }
        return nil
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

public enum CADEditOperationKind: String, Codable, Equatable, Sendable {
    case move
    case rotate
    case duplicate
    case delete
}

public struct CADEditOperation: Codable, Equatable, Sendable {
    public let kind: CADEditOperationKind
    public let selection: CADSelectionDescriptor
    public let deltaX: Float
    public let deltaY: Float
    public let radians: Float

    public init(
        kind: CADEditOperationKind,
        selection: CADSelectionDescriptor,
        deltaX: Float = 0,
        deltaY: Float = 0,
        radians: Float = 0
    ) {
        self.kind = kind
        self.selection = selection
        self.deltaX = deltaX
        self.deltaY = deltaY
        self.radians = radians
    }

    public func applying(to scene: CADScene) -> CADScene? {
        guard let resolved = selection.resolved(in: scene) else { return nil }
        switch kind {
        case .move:
            return CADSceneEditor.move(
                scene: scene,
                selection: resolved,
                delta: CADPoint(x: deltaX, y: deltaY)
            )
        case .rotate:
            return CADSceneEditor.rotate(
                scene: scene,
                selection: resolved,
                radians: radians
            )
        case .duplicate:
            return CADSceneEditor.duplicate(
                scene: scene,
                selection: resolved,
                offset: CADPoint(x: deltaX, y: deltaY)
            )
        case .delete:
            return CADSceneEditor.delete(scene: scene, selection: resolved)
        }
    }
}

/// Value-semantic edits for the first native editing pass.
///
/// Root primitives are edited in place. A primitive selected through a BLOCK
/// instance edits that instance, preserving shared definition geometry and
/// keeping copies compact.
public enum CADSceneEditor {
    public static func move(
        scene: CADScene,
        selection: CADSelectionResult,
        delta: CADPoint
    ) -> CADScene? {
        guard delta.x.isFinite, delta.y.isFinite else { return nil }
        if let instanceIndex = selection.instanceIndex {
            return transformInstance(
                scene: scene,
                instanceIndex: instanceIndex,
                transform: .translation(x: delta.x, y: delta.y)
            )
        }
        if selection.kind == .line,
           let lineIndex = selection.lineIndex,
           scene.rootGeometry.segment(at: lineIndex) != nil {
            return transformRootLine(
                scene: scene,
                lineIndex: lineIndex,
                transform: .translation(x: delta.x, y: delta.y)
            )
        }
        if selection.kind == .text,
           let annotationIndex = selection.annotationIndex,
           scene.rootAnnotations.indices.contains(annotationIndex) {
            return transformRootAnnotation(
                scene: scene,
                annotationIndex: annotationIndex,
                transform: .translation(x: delta.x, y: delta.y)
            )
        }
        if selection.kind == .fill,
           let fillIndex = selection.fillIndex,
           scene.rootFills.indices.contains(fillIndex) {
            return transformRootFill(
                scene: scene,
                fillIndex: fillIndex,
                transform: .translation(x: delta.x, y: delta.y)
            )
        }
        return nil
    }

    public static func rotate(
        scene: CADScene,
        selection: CADSelectionResult,
        radians: Float,
        center: CADPoint? = nil
    ) -> CADScene? {
        guard radians.isFinite else { return nil }
        let pivot = center ?? selection.point
        guard pivot.x.isFinite, pivot.y.isFinite else { return nil }
        let transform = rotationAround(point: pivot, radians: radians)
        if let instanceIndex = selection.instanceIndex {
            return transformInstance(
                scene: scene,
                instanceIndex: instanceIndex,
                transform: transform
            )
        }
        if selection.kind == .line, let lineIndex = selection.lineIndex,
           scene.rootGeometry.segment(at: lineIndex) != nil {
            return transformRootLine(scene: scene, lineIndex: lineIndex, transform: transform)
        }
        if selection.kind == .text,
           let annotationIndex = selection.annotationIndex,
           scene.rootAnnotations.indices.contains(annotationIndex) {
            return transformRootAnnotation(scene: scene, annotationIndex: annotationIndex, transform: transform)
        }
        if selection.kind == .fill,
           let fillIndex = selection.fillIndex,
           scene.rootFills.indices.contains(fillIndex) {
            return transformRootFill(scene: scene, fillIndex: fillIndex, transform: transform)
        }
        return nil
    }

    public static func duplicate(
        scene: CADScene,
        selection: CADSelectionResult,
        offset: CADPoint
    ) -> CADScene? {
        guard offset.x.isFinite, offset.y.isFinite else { return nil }
        let transform = CADTransform2D.translation(x: offset.x, y: offset.y)
        if let instanceIndex = selection.instanceIndex,
           scene.blockInstances.indices.contains(instanceIndex) {
            var instances = scene.blockInstances
            let source = instances[instanceIndex]
            let copiedTransform = transform.concatenating(source.transform)
            let copied = makeInstance(
                scene: scene,
                definitionID: source.definitionID,
                transform: copiedTransform,
                layerID: source.layerID
            )
            instances.append(copied)
            return rebuild(scene: scene, blockInstances: instances)
        }
        if selection.kind == .line, let lineIndex = selection.lineIndex,
           let source = scene.rootGeometry.segment(at: lineIndex) {
            var geometry = scene.rootGeometry
            do {
                try geometry.append(CADLineSegment(
                    start: transform.applying(to: source.start),
                    end: transform.applying(to: source.end),
                    layerID: source.layerID,
                    colorRGB: source.colorRGB,
                    colorIndex: source.colorIndex
                ))
            } catch {
                return nil
            }
            return rebuild(scene: scene, rootGeometry: geometry)
        }
        if selection.kind == .text,
           let annotationIndex = selection.annotationIndex,
           scene.rootAnnotations.indices.contains(annotationIndex) {
            var annotations = scene.rootAnnotations
            annotations.append(scene.rootAnnotations[annotationIndex].transformed(by: transform))
            return rebuild(scene: scene, rootAnnotations: annotations)
        }
        if selection.kind == .fill,
           let fillIndex = selection.fillIndex,
           scene.rootFills.indices.contains(fillIndex) {
            var fills = scene.rootFills
            fills.append(transformed(scene.rootFills[fillIndex], by: transform))
            return rebuild(scene: scene, rootFills: fills)
        }
        return nil
    }

    public static func delete(
        scene: CADScene,
        selection: CADSelectionResult
    ) -> CADScene? {
        if let instanceIndex = selection.instanceIndex,
           scene.blockInstances.indices.contains(instanceIndex) {
            var instances = scene.blockInstances
            instances.remove(at: instanceIndex)
            return rebuild(scene: scene, blockInstances: instances)
        }
        if selection.kind == .line,
           let lineIndex = selection.lineIndex,
           lineIndex >= 0,
           lineIndex < scene.rootGeometry.lineCount {
            var geometry = CADLineBuffer()
            do {
                for index in 0..<scene.rootGeometry.lineCount where index != lineIndex {
                    guard let segment = scene.rootGeometry.segment(at: index) else { continue }
                    try geometry.append(segment)
                }
            } catch {
                return nil
            }
            return rebuild(scene: scene, rootGeometry: geometry)
        }
        if selection.kind == .text,
           let annotationIndex = selection.annotationIndex,
           scene.rootAnnotations.indices.contains(annotationIndex) {
            var annotations = scene.rootAnnotations
            annotations.remove(at: annotationIndex)
            return rebuild(scene: scene, rootAnnotations: annotations)
        }
        if selection.kind == .fill,
           let fillIndex = selection.fillIndex,
           scene.rootFills.indices.contains(fillIndex) {
            var fills = scene.rootFills
            fills.remove(at: fillIndex)
            return rebuild(scene: scene, rootFills: fills)
        }
        return nil
    }

    private static func transformRootLine(
        scene: CADScene,
        lineIndex: Int,
        transform: CADTransform2D
    ) -> CADScene? {
        var geometry = CADLineBuffer()
        do {
            for index in 0..<scene.rootGeometry.lineCount {
                guard let segment = scene.rootGeometry.segment(at: index) else { continue }
                let next = index == lineIndex
                    ? CADLineSegment(
                        start: transform.applying(to: segment.start),
                        end: transform.applying(to: segment.end),
                        layerID: segment.layerID,
                        colorRGB: segment.colorRGB,
                        colorIndex: segment.colorIndex
                    )
                    : segment
                try geometry.append(next)
            }
        } catch {
            return nil
        }
        return rebuild(scene: scene, rootGeometry: geometry)
    }

    private static func transformRootAnnotation(
        scene: CADScene,
        annotationIndex: Int,
        transform: CADTransform2D
    ) -> CADScene? {
        guard scene.rootAnnotations.indices.contains(annotationIndex) else { return nil }
        var annotations = scene.rootAnnotations
        annotations[annotationIndex] = annotations[annotationIndex].transformed(by: transform)
        return rebuild(scene: scene, rootAnnotations: annotations)
    }

    private static func transformRootFill(
        scene: CADScene,
        fillIndex: Int,
        transform: CADTransform2D
    ) -> CADScene? {
        guard scene.rootFills.indices.contains(fillIndex) else { return nil }
        var fills = scene.rootFills
        fills[fillIndex] = transformed(fills[fillIndex], by: transform)
        return rebuild(scene: scene, rootFills: fills)
    }

    private static func transformed(_ fill: CADFillPolygon, by transform: CADTransform2D) -> CADFillPolygon {
        CADFillPolygon(
            points: fill.points.map { transform.applying(to: $0) },
            layerID: fill.layerID,
            colorRGB: fill.colorRGB,
            colorIndex: fill.colorIndex,
            isHole: fill.isHole
        )
    }

    private static func transformInstance(
        scene: CADScene,
        instanceIndex: Int,
        transform: CADTransform2D
    ) -> CADScene? {
        guard scene.blockInstances.indices.contains(instanceIndex) else { return nil }
        var instances = scene.blockInstances
        let source = instances[instanceIndex]
        let nextTransform = transform.concatenating(source.transform)
        instances[instanceIndex] = makeInstance(
            scene: scene,
            definitionID: source.definitionID,
            transform: nextTransform,
            layerID: source.layerID
        )
        return rebuild(scene: scene, blockInstances: instances)
    }

    private static func makeInstance(
        scene: CADScene,
        definitionID: Int,
        transform: CADTransform2D,
        layerID: UInt16
    ) -> CADBlockInstance {
        let bounds = scene.blockDefinitions[safe: definitionID]?.bounds
            .transformed(by: transform) ?? .empty
        return CADBlockInstance(
            definitionID: definitionID,
            transform: transform,
            layerID: layerID,
            bounds: bounds
        )
    }

    private static func rotationAround(point: CADPoint, radians: Float) -> CADTransform2D {
        CADTransform2D.translation(x: point.x, y: point.y)
            .concatenating(CADTransform2D.rotation(radians: radians))
            .concatenating(CADTransform2D.translation(x: -point.x, y: -point.y))
    }

    private static func rebuild(
        scene: CADScene,
        rootGeometry: CADLineBuffer? = nil,
        rootFills: [CADFillPolygon]? = nil,
        rootAnnotations: [CADTextAnnotation]? = nil,
        blockInstances: [CADBlockInstance]? = nil
    ) -> CADScene {
        let geometry = rootGeometry ?? scene.rootGeometry
        let fills = rootFills ?? scene.rootFills
        let annotations = rootAnnotations ?? scene.rootAnnotations
        let instances = blockInstances ?? scene.blockInstances
        var bounds = geometry.bounds
        for fill in fills { bounds.include(fill.bounds) }
        for annotation in annotations { bounds.include(annotation.bounds) }
        for instance in instances { bounds.include(instance.bounds) }
        return CADScene(
            rootGeometry: geometry,
            rootFills: fills,
            rootAnnotations: annotations,
            blockDefinitions: scene.blockDefinitions,
            blockInstances: instances,
            bounds: bounds,
            layerIDs: scene.layerIDs,
            layers: scene.layers
        )
    }
}

public extension CADTransform2D {
    static func rotation(radians: Float) -> CADTransform2D {
        CADTransform2D(
            a: cos(radians),
            b: sin(radians),
            c: -sin(radians),
            d: cos(radians),
            tx: 0,
            ty: 0
        )
    }
}
