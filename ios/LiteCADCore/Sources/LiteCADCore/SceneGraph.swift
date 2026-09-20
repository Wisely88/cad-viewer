import Foundation

public struct CADPoint: Codable, Equatable, Sendable {
    public let x: Float
    public let y: Float

    public init(x: Float, y: Float) {
        self.x = x
        self.y = y
    }
}

public struct CADRect: Equatable, Sendable {
    public private(set) var minX: Float
    public private(set) var minY: Float
    public private(set) var maxX: Float
    public private(set) var maxY: Float

    public init(minX: Float, minY: Float, maxX: Float, maxY: Float) {
        self.minX = minX
        self.minY = minY
        self.maxX = maxX
        self.maxY = maxY
    }

    public static var empty: CADRect {
        CADRect(minX: .infinity, minY: .infinity, maxX: -.infinity, maxY: -.infinity)
    }

    public var isEmpty: Bool {
        minX > maxX || minY > maxY
    }

    public var width: Float {
        isEmpty ? 0 : maxX - minX
    }

    public var height: Float {
        isEmpty ? 0 : maxY - minY
    }

    public func intersects(_ other: CADRect) -> Bool {
        guard !isEmpty, !other.isEmpty else { return false }
        return minX <= other.maxX && maxX >= other.minX
            && minY <= other.maxY && maxY >= other.minY
    }

    public func contains(_ point: CADPoint) -> Bool {
        guard !isEmpty else { return false }
        return point.x >= minX && point.x <= maxX
            && point.y >= minY && point.y <= maxY
    }

    public mutating func include(_ point: CADPoint) {
        if isEmpty {
            minX = point.x
            minY = point.y
            maxX = point.x
            maxY = point.y
            return
        }

        minX = Swift.min(minX, point.x)
        minY = Swift.min(minY, point.y)
        maxX = Swift.max(maxX, point.x)
        maxY = Swift.max(maxY, point.y)
    }

    public mutating func include(_ rect: CADRect) {
        guard !rect.isEmpty else { return }
        include(CADPoint(x: rect.minX, y: rect.minY))
        include(CADPoint(x: rect.maxX, y: rect.maxY))
    }

    public func transformed(by transform: CADTransform2D) -> CADRect {
        guard !isEmpty else { return self }

        let corners = [
            CADPoint(x: minX, y: minY),
            CADPoint(x: minX, y: maxY),
            CADPoint(x: maxX, y: minY),
            CADPoint(x: maxX, y: maxY)
        ]
        var result = CADRect.empty
        for corner in corners {
            result.include(transform.applying(to: corner))
        }
        return result
    }
}

public struct CADTransform2D: Codable, Equatable, Sendable {
    public let a: Float
    public let b: Float
    public let c: Float
    public let d: Float
    public let tx: Float
    public let ty: Float

    public init(a: Float, b: Float, c: Float, d: Float, tx: Float, ty: Float) {
        self.a = a
        self.b = b
        self.c = c
        self.d = d
        self.tx = tx
        self.ty = ty
    }

    public static let identity = CADTransform2D(a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0)

    public static func translation(x: Float, y: Float) -> CADTransform2D {
        CADTransform2D(a: 1, b: 0, c: 0, d: 1, tx: x, ty: y)
    }

    public func applying(to point: CADPoint) -> CADPoint {
        CADPoint(
            x: a * point.x + c * point.y + tx,
            y: b * point.x + d * point.y + ty
        )
    }

    /// Returns a transform that applies `other`, then applies `self`.
    public func concatenating(_ other: CADTransform2D) -> CADTransform2D {
        CADTransform2D(
            a: a * other.a + c * other.b,
            b: b * other.a + d * other.b,
            c: a * other.c + c * other.d,
            d: b * other.c + d * other.d,
            tx: a * other.tx + c * other.ty + tx,
            ty: b * other.tx + d * other.ty + ty
        )
    }
}

public struct CADLineSegment: Codable, Equatable, Sendable {
    public let start: CADPoint
    public let end: CADPoint
    public let layerID: UInt16
    public let colorRGB: UInt32
    public let colorIndex: UInt16

    public init(
        start: CADPoint,
        end: CADPoint,
        layerID: UInt16 = 0,
        colorRGB: UInt32 = 0,
        colorIndex: UInt16 = 0
    ) {
        self.start = start
        self.end = end
        self.layerID = layerID
        self.colorRGB = colorRGB
        self.colorIndex = colorIndex
    }

    public var bounds: CADRect {
        var result = CADRect.empty
        result.include(start)
        result.include(end)
        return result
    }
}

public enum CADTextKind: UInt8, Codable, Equatable, Sendable {
    case text = 0
    case mtext = 1
    case dimension = 2
}

public enum CADLinePattern: UInt8, Equatable, Sendable {
    case solid = 0
    case dashed = 1
    case dotted = 2
    case center = 3
}

public struct CADFillPolygon: Codable, Equatable, Sendable {
    public let points: [CADPoint]
    public let layerID: UInt16
    public let colorRGB: UInt32
    public let colorIndex: UInt16
    public let isHole: Bool

    public init(
        points: [CADPoint],
        layerID: UInt16 = 0,
        colorRGB: UInt32 = 0,
        colorIndex: UInt16 = 0,
        isHole: Bool = false
    ) {
        self.points = points
        self.layerID = layerID
        self.colorRGB = colorRGB
        self.colorIndex = colorIndex
        self.isHole = isHole
    }

    public var bounds: CADRect {
        var result = CADRect.empty
        for point in points { result.include(point) }
        return result
    }
}

public struct CADLayer: Equatable, Sendable, Identifiable {
    public let id: UInt16
    public let name: String
    public let colorIndex: UInt16
    /// Packed 0xRRGGBB true color. Zero means that the source only exposed an ACI color.
    public let colorRGB: UInt32
    public let lineWeight: UInt16
    public let linePattern: CADLinePattern

    public init(
        id: UInt16,
        name: String,
        colorIndex: UInt16 = 0,
        colorRGB: UInt32 = 0,
        lineWeight: UInt16 = 0,
        linePattern: CADLinePattern = .solid
    ) {
        self.id = id
        self.name = name
        self.colorIndex = colorIndex
        self.colorRGB = colorRGB
        self.lineWeight = lineWeight
        self.linePattern = linePattern
    }
}

public struct CADTextAnnotation: Codable, Equatable, Sendable {
    public let text: String
    public let position: CADPoint
    public let height: Float
    public let rotation: Float
    public let widthFactor: Float
    public let layerID: UInt16
    public let kind: CADTextKind
    public let horizontalAlignment: UInt8
    public let verticalAlignment: UInt8
    public let attachment: UInt8

    public init(
        text: String,
        position: CADPoint,
        height: Float,
        rotation: Float = 0,
        widthFactor: Float = 1,
        layerID: UInt16 = 0,
        kind: CADTextKind = .text,
        horizontalAlignment: UInt8 = 0,
        verticalAlignment: UInt8 = 0,
        attachment: UInt8 = 0
    ) {
        self.text = text
        self.position = position
        self.height = height
        self.rotation = rotation
        self.widthFactor = widthFactor
        self.layerID = layerID
        self.kind = kind
        self.horizontalAlignment = horizontalAlignment
        self.verticalAlignment = verticalAlignment
        self.attachment = attachment
    }

    public var bounds: CADRect {
        let width = max(Float(text.count) * height * 0.65 * widthFactor, height)
        let halfWidth = width * 0.5
        let halfHeight = height * 0.5
        let corners = [
            CADPoint(x: position.x - halfWidth, y: position.y - halfHeight),
            CADPoint(x: position.x - halfWidth, y: position.y + halfHeight),
            CADPoint(x: position.x + halfWidth, y: position.y - halfHeight),
            CADPoint(x: position.x + halfWidth, y: position.y + halfHeight)
        ]
        let rotationTransform = CADTransform2D(
            a: cos(rotation),
            b: sin(rotation),
            c: -sin(rotation),
            d: cos(rotation),
            tx: 0,
            ty: 0
        )
        var result = CADRect.empty
        for corner in corners {
            let relative = CADPoint(x: corner.x - position.x, y: corner.y - position.y)
            let rotated = rotationTransform.applying(to: relative)
            result.include(CADPoint(x: rotated.x + position.x, y: rotated.y + position.y))
        }
        return result
    }

    public func transformed(by transform: CADTransform2D) -> CADTextAnnotation {
        let axisEnd = transform.applying(to: CADPoint(x: 1, y: 0))
        let axisStart = transform.applying(to: CADPoint(x: 0, y: 0))
        let axis = CADPoint(x: axisEnd.x - axisStart.x, y: axisEnd.y - axisStart.y)
        let scale = max(hypot(axis.x, axis.y), 0.000_001)
        return CADTextAnnotation(
            text: text,
            position: transform.applying(to: position),
            height: height * scale,
            rotation: rotation + atan2(axis.y, axis.x),
            widthFactor: widthFactor,
            layerID: layerID,
            kind: kind,
            horizontalAlignment: horizontalAlignment,
            verticalAlignment: verticalAlignment,
            attachment: attachment
        )
    }
}

public struct CADLineBuffer: Equatable, Sendable {
    /// Four tightly packed Float32 values per segment: x1, y1, x2, y2.
    public private(set) var coordinates: [Float] = []
    public private(set) var layerIDs: [UInt16] = []
    public private(set) var colorRGBs: [UInt32] = []
    public private(set) var colorIndices: [UInt16] = []

    public init() {}

    public var lineCount: Int {
        coordinates.count / 4
    }

    public var isEmpty: Bool {
        lineCount == 0
    }

    public mutating func append(_ segment: CADLineSegment) throws {
        guard segment.start.x.isFinite, segment.start.y.isFinite,
              segment.end.x.isFinite, segment.end.y.isFinite else {
            throw SceneGraphError.nonFiniteCoordinate
        }

        coordinates.append(segment.start.x)
        coordinates.append(segment.start.y)
        coordinates.append(segment.end.x)
        coordinates.append(segment.end.y)
        layerIDs.append(segment.layerID)
        colorRGBs.append(segment.colorRGB)
        colorIndices.append(segment.colorIndex)
    }

    public func segment(at index: Int) -> CADLineSegment? {
        guard index >= 0, index < lineCount else { return nil }
        let offset = index * 4
        return CADLineSegment(
            start: CADPoint(x: coordinates[offset], y: coordinates[offset + 1]),
            end: CADPoint(x: coordinates[offset + 2], y: coordinates[offset + 3]),
            layerID: layerIDs[index],
            colorRGB: colorRGBs[index],
            colorIndex: colorIndices[index]
        )
    }

    public var bounds: CADRect {
        var result = CADRect.empty
        for index in 0..<lineCount {
            guard let segment = segment(at: index) else { continue }
            result.include(segment.start)
            result.include(segment.end)
        }
        return result
    }
}

public enum CADSnapKind: String, Equatable, Sendable {
    case endpoint
    case midpoint
    case nearest
}

public struct CADSnapResult: Equatable, Sendable {
    public let point: CADPoint
    public let kind: CADSnapKind
    public let distance: Float

    public init(point: CADPoint, kind: CADSnapKind, distance: Float) {
        self.point = point
        self.kind = kind
        self.distance = distance
    }
}

public enum CADSelectionKind: String, Codable, Equatable, Sendable {
    case line
    case text
    case fill
}

public struct CADSelectionResult: Equatable, Sendable {
    public let kind: CADSelectionKind
    public let point: CADPoint
    public let distance: Float
    public let layerID: UInt16
    public let lineIndex: Int?
    public let annotationIndex: Int?
    public let fillIndex: Int?
    public let definitionID: Int?
    public let instanceIndex: Int?
    public let text: String?

    public init(
        kind: CADSelectionKind,
        point: CADPoint,
        distance: Float,
        layerID: UInt16,
        lineIndex: Int? = nil,
        annotationIndex: Int? = nil,
        fillIndex: Int? = nil,
        definitionID: Int? = nil,
        instanceIndex: Int? = nil,
        text: String? = nil
    ) {
        self.kind = kind
        self.point = point
        self.distance = distance
        self.layerID = layerID
        self.lineIndex = lineIndex
        self.annotationIndex = annotationIndex
        self.fillIndex = fillIndex
        self.definitionID = definitionID
        self.instanceIndex = instanceIndex
        self.text = text
    }
}

public struct CADNestedBlockInstance: Equatable, Sendable {
    public let definitionID: Int
    public let transform: CADTransform2D
    public let layerID: UInt16

    public init(
        definitionID: Int,
        transform: CADTransform2D = .identity,
        layerID: UInt16 = 0
    ) {
        self.definitionID = definitionID
        self.transform = transform
        self.layerID = layerID
    }
}

public struct CADBlockDefinition: Equatable, Sendable {
    public let id: Int
    public let name: String
    public let geometry: CADLineBuffer
    public let fills: [CADFillPolygon]
    public let annotations: [CADTextAnnotation]
    public let nestedInstances: [CADNestedBlockInstance]
    public let bounds: CADRect

    public init(
        id: Int,
        name: String,
        geometry: CADLineBuffer,
        fills: [CADFillPolygon] = [],
        annotations: [CADTextAnnotation] = [],
        nestedInstances: [CADNestedBlockInstance] = [],
        bounds: CADRect? = nil
    ) {
        self.id = id
        self.name = name
        self.geometry = geometry
        self.fills = fills
        self.annotations = annotations
        self.nestedInstances = nestedInstances
        var definitionBounds = geometry.bounds
        for fill in fills {
            definitionBounds.include(fill.bounds)
        }
        for annotation in annotations {
            definitionBounds.include(annotation.bounds)
        }
        self.bounds = bounds ?? definitionBounds
    }
}

public struct CADBlockInstance: Equatable, Sendable {
    public let definitionID: Int
    public let transform: CADTransform2D
    public let layerID: UInt16
    public let bounds: CADRect

    public init(definitionID: Int, transform: CADTransform2D, layerID: UInt16, bounds: CADRect) {
        self.definitionID = definitionID
        self.transform = transform
        self.layerID = layerID
        self.bounds = bounds
    }
}

public struct CADScene: Equatable, Sendable {
    public let rootGeometry: CADLineBuffer
    public let rootFills: [CADFillPolygon]
    public let rootAnnotations: [CADTextAnnotation]
    public let blockDefinitions: [CADBlockDefinition]
    public let blockInstances: [CADBlockInstance]
    public let bounds: CADRect
    public let focusBounds: CADRect
    public let layerIDs: [UInt16]
    public let layers: [CADLayer]

    public init(
        rootGeometry: CADLineBuffer,
        rootFills: [CADFillPolygon] = [],
        rootAnnotations: [CADTextAnnotation] = [],
        blockDefinitions: [CADBlockDefinition],
        blockInstances: [CADBlockInstance],
        bounds: CADRect,
        focusBounds: CADRect? = nil,
        layerIDs: [UInt16]? = nil,
        layers: [CADLayer] = []
    ) {
        self.rootGeometry = rootGeometry
        self.rootFills = rootFills
        self.rootAnnotations = rootAnnotations
        self.blockDefinitions = blockDefinitions
        self.blockInstances = blockInstances
        self.bounds = bounds
        self.focusBounds = focusBounds ?? Self.computeFocusBounds(
            rootGeometry: rootGeometry,
            rootFills: rootFills,
            rootAnnotations: rootAnnotations,
            blockInstances: blockInstances,
            fullBounds: bounds
        )
        self.layerIDs = layerIDs ?? Self.collectLayerIDs(
            rootGeometry: rootGeometry,
            rootFills: rootFills,
            rootAnnotations: rootAnnotations,
            blockDefinitions: blockDefinitions,
            blockInstances: blockInstances
        )
        self.layers = layers.isEmpty
            ? self.layerIDs.map { CADLayer(id: $0, name: "Layer \($0)") }
            : layers.sorted { $0.id < $1.id }
    }

    public var storedLineCount: Int {
        rootGeometry.lineCount + blockDefinitions.reduce(0) { $0 + $1.geometry.lineCount }
    }

    public var instanceLineCount: Int {
        rootGeometry.lineCount + blockInstances.reduce(0) { total, instance in
            guard let definition = blockDefinitions[safe: instance.definitionID] else { return total }
            return total + definition.geometry.lineCount
        }
    }

    /// Finds a precise geometric point near the user's tap without flattening
    /// block geometry. The segment budget keeps a tap responsive on very large
    /// drawings; root geometry is inspected before block definitions.
    public func snapPoint(
        near point: CADPoint,
        tolerance: Float,
        visibleBounds: CADRect? = nil,
        hiddenLayers: Set<UInt16> = [],
        maximumSegments: Int = 250_000
    ) -> CADSnapResult? {
        guard tolerance.isFinite, tolerance > 0, maximumSegments > 0 else { return nil }

        let searchBounds: CADRect? = visibleBounds.map {
            CADRect(
                minX: $0.minX - tolerance,
                minY: $0.minY - tolerance,
                maxX: $0.maxX + tolerance,
                maxY: $0.maxY + tolerance
            )
        }
        var inspectedSegments = 0
        var best: CADSnapResult?

        func isBetter(_ candidate: CADSnapResult, than current: CADSnapResult?) -> Bool {
            guard let current else { return true }
            let priority: [CADSnapKind: Int] = [.endpoint: 0, .midpoint: 1, .nearest: 2]
            let candidatePriority = priority[candidate.kind, default: 3]
            let currentPriority = priority[current.kind, default: 3]
            if candidatePriority != currentPriority {
                return candidatePriority < currentPriority
            }
            return candidate.distance < current.distance
        }

        func consider(_ candidate: CADPoint, kind: CADSnapKind) {
            let distance = hypot(candidate.x - point.x, candidate.y - point.y)
            guard distance <= tolerance else { return }
            let result = CADSnapResult(point: candidate, kind: kind, distance: distance)
            if isBetter(result, than: best) {
                best = result
            }
        }

        func considerSegment(_ segment: CADLineSegment, transform: CADTransform2D) {
            guard inspectedSegments < maximumSegments,
                  !hiddenLayers.contains(segment.layerID) else { return }

            let start = transform.applying(to: segment.start)
            let end = transform.applying(to: segment.end)
            var bounds = CADRect.empty
            bounds.include(start)
            bounds.include(end)
            if let searchBounds, !bounds.intersects(searchBounds) { return }
            inspectedSegments += 1

            consider(start, kind: .endpoint)
            consider(end, kind: .endpoint)
            let midpoint = CADPoint(
                x: (start.x + end.x) / 2,
                y: (start.y + end.y) / 2
            )
            consider(midpoint, kind: .midpoint)

            let dx = end.x - start.x
            let dy = end.y - start.y
            let lengthSquared = dx * dx + dy * dy
            guard lengthSquared > 0.000_000_1 else { return }
            let rawT = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
            let t = min(max(rawT, 0), 1)
            let nearest = CADPoint(x: start.x + dx * t, y: start.y + dy * t)
            let kind: CADSnapKind = t <= 0.001 || t >= 0.999 ? .endpoint : .nearest
            consider(nearest, kind: kind)
        }

        func visitDefinition(
            _ definitionID: Int,
            transform: CADTransform2D,
            depth: Int
        ) {
            guard inspectedSegments < maximumSegments,
                  depth < 64,
                  blockDefinitions.indices.contains(definitionID) else { return }
            let definition = blockDefinitions[definitionID]
            for index in 0..<definition.geometry.lineCount {
                guard let segment = definition.geometry.segment(at: index) else { continue }
                considerSegment(segment, transform: transform)
                if inspectedSegments >= maximumSegments { return }
            }
            for nested in definition.nestedInstances where !hiddenLayers.contains(nested.layerID) {
                guard blockDefinitions.indices.contains(nested.definitionID) else { continue }
                let combined = transform.concatenating(nested.transform)
                if let searchBounds,
                   !blockDefinitions[nested.definitionID].bounds
                        .transformed(by: combined)
                        .intersects(searchBounds) {
                    continue
                }
                visitDefinition(nested.definitionID, transform: combined, depth: depth + 1)
                if inspectedSegments >= maximumSegments { return }
            }
        }

        for index in 0..<rootGeometry.lineCount {
            guard let segment = rootGeometry.segment(at: index) else { continue }
            considerSegment(segment, transform: .identity)
            if inspectedSegments >= maximumSegments { return best }
        }
        for instance in blockInstances
            where !hiddenLayers.contains(instance.layerID)
                && (searchBounds == nil || instance.bounds.intersects(searchBounds!)) {
            visitDefinition(instance.definitionID, transform: instance.transform, depth: 0)
            if inspectedSegments >= maximumSegments { break }
        }
        return best
    }

    /// Returns the nearest selectable primitive in the current viewport. The same
    /// visibility and segment budget rules as snapping keep large DWGs responsive.
    public func hitTest(
        near point: CADPoint,
        tolerance: Float,
        visibleBounds: CADRect? = nil,
        hiddenLayers: Set<UInt16> = [],
        maximumSegments: Int = 250_000
    ) -> CADSelectionResult? {
        guard tolerance.isFinite, tolerance > 0, maximumSegments > 0 else { return nil }
        var best: CADSelectionResult?
        var inspected = 0

        func consider(_ candidate: CADSelectionResult) {
            guard candidate.distance <= tolerance else { return }
            if best == nil || candidate.distance < best!.distance { best = candidate }
        }

        func considerSegment(
            _ segment: CADLineSegment,
            transform: CADTransform2D,
            lineIndex: Int,
            definitionID: Int?,
            instanceIndex: Int?
        ) {
            guard inspected < maximumSegments, !hiddenLayers.contains(segment.layerID) else { return }
            let start = transform.applying(to: segment.start)
            let end = transform.applying(to: segment.end)
            var bounds = CADRect.empty
            bounds.include(start)
            bounds.include(end)
            if let visibleBounds, !bounds.intersects(visibleBounds) { return }
            inspected += 1
            let dx = end.x - start.x
            let dy = end.y - start.y
            let lengthSquared = dx * dx + dy * dy
            let rawT = lengthSquared > 0.000_000_1
                ? ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
                : 0
            let t = min(max(rawT, 0), 1)
            let nearest = CADPoint(x: start.x + dx * t, y: start.y + dy * t)
            consider(CADSelectionResult(
                kind: .line,
                point: nearest,
                distance: hypot(nearest.x - point.x, nearest.y - point.y),
                layerID: segment.layerID,
                lineIndex: lineIndex,
                definitionID: definitionID,
                instanceIndex: instanceIndex
            ))
        }

        func considerFill(
            _ fill: CADFillPolygon,
            transform: CADTransform2D,
            fillIndex: Int,
            definitionID: Int?,
            instanceIndex: Int?
        ) {
            guard !fill.isHole, !hiddenLayers.contains(fill.layerID) else { return }
            let points = fill.points.map { transform.applying(to: $0) }
            guard points.count >= 3 else { return }
            var bounds = CADRect.empty
            for candidate in points { bounds.include(candidate) }
            if let visibleBounds, !bounds.intersects(visibleBounds) { return }
            var inside = false
            var previous = points[points.count - 1]
            for current in points {
                let crosses = (current.y > point.y) != (previous.y > point.y)
                if crosses {
                    let xAtPoint = (previous.x - current.x) * (point.y - current.y)
                        / (previous.y - current.y) + current.x
                    if point.x < xAtPoint { inside.toggle() }
                }
                previous = current
            }
            guard inside else { return }
            consider(CADSelectionResult(
                kind: .fill,
                point: point,
                distance: 0,
                layerID: fill.layerID,
                fillIndex: fillIndex,
                definitionID: definitionID,
                instanceIndex: instanceIndex
            ))
        }

        for index in 0..<rootGeometry.lineCount {
            guard let segment = rootGeometry.segment(at: index) else { continue }
            considerSegment(segment, transform: .identity, lineIndex: index, definitionID: nil, instanceIndex: nil)
            if inspected >= maximumSegments { return best }
        }
        for (instanceIndex, instance) in blockInstances.enumerated()
            where !hiddenLayers.contains(instance.layerID)
                && (visibleBounds == nil || instance.bounds.intersects(visibleBounds!)) {
            guard blockDefinitions.indices.contains(instance.definitionID) else { continue }
            let definition = blockDefinitions[instance.definitionID]
            for index in 0..<definition.geometry.lineCount {
                guard let segment = definition.geometry.segment(at: index) else { continue }
                considerSegment(
                    segment,
                    transform: instance.transform,
                    lineIndex: index,
                    definitionID: instance.definitionID,
                    instanceIndex: instanceIndex
                )
                if inspected >= maximumSegments { return best }
            }
            for (fillIndex, fill) in definition.fills.enumerated() {
                considerFill(
                    fill,
                    transform: instance.transform,
                    fillIndex: fillIndex,
                    definitionID: instance.definitionID,
                    instanceIndex: instanceIndex
                )
            }
            for (annotationIndex, annotation) in definition.annotations.enumerated()
                where !hiddenLayers.contains(annotation.layerID) {
                let transformed = annotation.transformed(by: instance.transform)
                consider(CADSelectionResult(
                    kind: .text,
                    point: transformed.position,
                    distance: hypot(transformed.position.x - point.x, transformed.position.y - point.y),
                    layerID: transformed.layerID,
                    annotationIndex: annotationIndex,
                    definitionID: instance.definitionID,
                    instanceIndex: instanceIndex,
                    text: transformed.text
                ))
            }
        }
        for (fillIndex, fill) in rootFills.enumerated() {
            considerFill(
                fill,
                transform: .identity,
                fillIndex: fillIndex,
                definitionID: nil,
                instanceIndex: nil
            )
        }
        for (annotationIndex, annotation) in rootAnnotations.enumerated()
            where !hiddenLayers.contains(annotation.layerID) {
            consider(CADSelectionResult(
                kind: .text,
                point: annotation.position,
                distance: hypot(annotation.position.x - point.x, annotation.position.y - point.y),
                layerID: annotation.layerID,
                annotationIndex: annotationIndex,
                text: annotation.text
            ))
        }
        return best
    }

    private static func collectLayerIDs(
        rootGeometry: CADLineBuffer,
        rootFills: [CADFillPolygon],
        rootAnnotations: [CADTextAnnotation],
        blockDefinitions: [CADBlockDefinition],
        blockInstances: [CADBlockInstance]
    ) -> [UInt16] {
        var ids = Set(rootGeometry.layerIDs)
        ids.formUnion(rootFills.map(\.layerID))
        for definition in blockDefinitions {
            ids.formUnion(definition.geometry.layerIDs)
            ids.formUnion(definition.fills.map(\.layerID))
            ids.formUnion(definition.annotations.map(\.layerID))
            ids.formUnion(definition.nestedInstances.map(\.layerID))
        }
        ids.formUnion(blockInstances.map(\.layerID))
        ids.formUnion(rootAnnotations.map(\.layerID))
        return ids.sorted()
    }

    private static func computeFocusBounds(
        rootGeometry: CADLineBuffer,
        rootFills: [CADFillPolygon],
        rootAnnotations: [CADTextAnnotation],
        blockInstances: [CADBlockInstance],
        fullBounds: CADRect
    ) -> CADRect {
        guard !fullBounds.isEmpty else { return fullBounds }

        var sampleX: [Float] = []
        var sampleY: [Float] = []
        let rootStep = max(1, rootGeometry.lineCount / 2_000)
        for index in stride(from: 0, to: rootGeometry.lineCount, by: rootStep) {
            guard let segment = rootGeometry.segment(at: index) else { continue }
            sampleX.append((segment.start.x + segment.end.x) / 2)
            sampleY.append((segment.start.y + segment.end.y) / 2)
        }
        for fill in rootFills {
            let bounds = fill.bounds
            guard !bounds.isEmpty else { continue }
            sampleX.append((bounds.minX + bounds.maxX) / 2)
            sampleY.append((bounds.minY + bounds.maxY) / 2)
        }
        sampleX.append(contentsOf: rootAnnotations.map(\.position.x))
        sampleY.append(contentsOf: rootAnnotations.map(\.position.y))

        let instanceStep = max(1, blockInstances.count / 2_000)
        for index in stride(from: 0, to: blockInstances.count, by: instanceStep) {
            let bounds = blockInstances[index].bounds
            guard !bounds.isEmpty else { continue }
            sampleX.append((bounds.minX + bounds.maxX) / 2)
            sampleY.append((bounds.minY + bounds.maxY) / 2)
        }

        guard sampleX.count >= 20, sampleY.count >= 20 else { return fullBounds }
        sampleX.sort()
        sampleY.sort()
        let lowIndex = Int(Float(sampleX.count - 1) * 0.02)
        let highIndex = Int(Float(sampleX.count - 1) * 0.98)
        let lowX = sampleX[lowIndex]
        let highX = sampleX[highIndex]
        let lowY = sampleY[Int(Float(sampleY.count - 1) * 0.02)]
        let highY = sampleY[Int(Float(sampleY.count - 1) * 0.98)]
        let padX = max((highX - lowX) * 0.05, 50)
        let padY = max((highY - lowY) * 0.05, 50)

        return CADRect(
            minX: max(fullBounds.minX, lowX - padX),
            minY: max(fullBounds.minY, lowY - padY),
            maxX: min(fullBounds.maxX, highX + padX),
            maxY: min(fullBounds.maxY, highY + padY)
        )
    }
}

public struct CADTextSearchResult: Equatable, Identifiable, Sendable {
    public let id: String
    public let text: String
    public let point: CADPoint
    public let layerID: UInt16
    public let kind: CADTextKind

    public init(id: String, text: String, point: CADPoint, layerID: UInt16, kind: CADTextKind) {
        self.id = id
        self.text = text
        self.point = point
        self.layerID = layerID
        self.kind = kind
    }
}

public extension CADScene {
    func textMatches(query: String, maximumResults: Int = 100) -> [CADTextSearchResult] {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedQuery.isEmpty, maximumResults > 0 else { return [] }
        var results: [CADTextSearchResult] = []
        for (index, annotation) in rootAnnotations.enumerated()
            where annotation.text.localizedCaseInsensitiveContains(normalizedQuery) {
            results.append(CADTextSearchResult(
                id: "root-\(index)",
                text: annotation.text,
                point: annotation.position,
                layerID: annotation.layerID,
                kind: annotation.kind
            ))
        }
        for (instanceIndex, instance) in blockInstances.enumerated() {
            appendTextMatches(
                definitionID: instance.definitionID,
                transform: instance.transform,
                query: normalizedQuery,
                prefix: "instance-\(instanceIndex)",
                results: &results,
                maximumResults: maximumResults
            )
            if results.count >= maximumResults { break }
        }
        return Array(results.prefix(maximumResults))
    }

    private func appendTextMatches(
        definitionID: Int,
        transform: CADTransform2D,
        query: String,
        prefix: String,
        results: inout [CADTextSearchResult],
        maximumResults: Int,
        depth: Int = 0
    ) {
        guard depth < 64,
              results.count < maximumResults,
              blockDefinitions.indices.contains(definitionID) else { return }
        let definition = blockDefinitions[definitionID]
        for (annotationIndex, annotation) in definition.annotations.enumerated()
            where annotation.text.localizedCaseInsensitiveContains(query) {
            let transformed = annotation.transformed(by: transform)
            results.append(CADTextSearchResult(
                id: "\(prefix)-d\(definitionID)-a\(annotationIndex)",
                text: transformed.text,
                point: transformed.position,
                layerID: transformed.layerID,
                kind: transformed.kind
            ))
            if results.count >= maximumResults { return }
        }
        for (nestedIndex, nested) in definition.nestedInstances.enumerated() {
            appendTextMatches(
                definitionID: nested.definitionID,
                transform: transform.concatenating(nested.transform),
                query: query,
                prefix: "\(prefix)-n\(nestedIndex)",
                results: &results,
                maximumResults: maximumResults,
                depth: depth + 1
            )
            if results.count >= maximumResults { return }
        }
    }
}

public enum SceneGraphError: Error, Equatable {
    case invalidBlockName
    case missingBlockDefinition(Int)
    case nonFiniteCoordinate
}

public final class CADSceneBuilder {
    private var rootGeometry = CADLineBuffer()
    private var rootFills: [CADFillPolygon] = []
    private var rootAnnotations: [CADTextAnnotation] = []
    private var blockDefinitions: [CADBlockDefinition] = []
    private var blockInstances: [CADBlockInstance] = []
    private var sceneBounds = CADRect.empty
    private var sceneLayerIDs = Set<UInt16>()
    private var sceneLayers: [UInt16: CADLayer] = [:]

    public init() {}

    public func registerLayer(_ layer: CADLayer) {
        sceneLayers[layer.id] = layer
        sceneLayerIDs.insert(layer.id)
    }

    public func appendRootLine(_ segment: CADLineSegment) throws {
        try rootGeometry.append(segment)
        sceneLayerIDs.insert(segment.layerID)
        sceneBounds.include(segment.start)
        sceneBounds.include(segment.end)
    }

    public func appendRootFill(_ fill: CADFillPolygon) {
        guard fill.points.count >= 3, !fill.bounds.isEmpty else { return }
        rootFills.append(fill)
        sceneLayerIDs.insert(fill.layerID)
        sceneBounds.include(fill.bounds)
    }

    @discardableResult
    public func addBlockDefinition(
        name: String,
        geometry: CADLineBuffer,
        fills: [CADFillPolygon] = [],
        annotations: [CADTextAnnotation] = [],
        nestedInstances: [CADNestedBlockInstance] = []
    ) throws -> Int {
        guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw SceneGraphError.invalidBlockName
        }

        let id = blockDefinitions.count
        blockDefinitions.append(
            CADBlockDefinition(
                id: id,
                name: name,
                geometry: geometry,
                fills: fills,
                annotations: annotations,
                nestedInstances: nestedInstances
            )
        )
        sceneLayerIDs.formUnion(geometry.layerIDs)
        sceneLayerIDs.formUnion(fills.map(\.layerID))
        sceneLayerIDs.formUnion(annotations.map(\.layerID))
        return id
    }

    public func appendRootAnnotation(_ annotation: CADTextAnnotation) {
        guard !annotation.text.isEmpty,
              annotation.position.x.isFinite,
              annotation.position.y.isFinite,
              annotation.height.isFinite,
              annotation.height > 0 else { return }
        rootAnnotations.append(annotation)
        sceneLayerIDs.insert(annotation.layerID)
        sceneBounds.include(annotation.bounds)
    }

    public func appendBlockInstance(
        definitionID: Int,
        transform: CADTransform2D = .identity,
        layerID: UInt16 = 0
    ) throws {
        guard let definition = blockDefinitions[safe: definitionID] else {
            throw SceneGraphError.missingBlockDefinition(definitionID)
        }

        let bounds = definition.bounds.transformed(by: transform)
        blockInstances.append(
            CADBlockInstance(
                definitionID: definitionID,
                transform: transform,
                layerID: layerID,
                bounds: bounds
            )
        )
        sceneLayerIDs.insert(layerID)
        sceneBounds.include(bounds)
    }

    public func build() -> CADScene {
        var resolvedDefinitions = blockDefinitions
        var resolving = Set<Int>()

        func resolvedBounds(for definitionID: Int) -> CADRect {
            guard resolvedDefinitions.indices.contains(definitionID) else {
                return .empty
            }
            if resolving.contains(definitionID) {
                return resolvedDefinitions[definitionID].bounds
            }
            resolving.insert(definitionID)
            let definition = resolvedDefinitions[definitionID]
            var bounds = definition.bounds
            for nested in definition.nestedInstances {
                let childBounds = resolvedBounds(for: nested.definitionID)
                bounds.include(childBounds.transformed(by: nested.transform))
            }
            resolving.remove(definitionID)
            if bounds != definition.bounds {
                resolvedDefinitions[definitionID] = CADBlockDefinition(
                    id: definition.id,
                    name: definition.name,
                    geometry: definition.geometry,
                    fills: definition.fills,
                    annotations: definition.annotations,
                    nestedInstances: definition.nestedInstances,
                    bounds: bounds
                )
            }
            return bounds
        }

        for definitionID in resolvedDefinitions.indices {
            _ = resolvedBounds(for: definitionID)
        }

        var resolvedInstances: [CADBlockInstance] = []
        resolvedInstances.reserveCapacity(blockInstances.count)
        var resolvedBounds = rootGeometry.bounds
        for fill in rootFills {
            resolvedBounds.include(fill.bounds)
        }
        for annotation in rootAnnotations {
            resolvedBounds.include(annotation.bounds)
        }
        for instance in blockInstances {
            let definitionBounds = resolvedDefinitions[safe: instance.definitionID]?.bounds ?? .empty
            let instanceBounds = definitionBounds.transformed(by: instance.transform)
            resolvedInstances.append(
                CADBlockInstance(
                    definitionID: instance.definitionID,
                    transform: instance.transform,
                    layerID: instance.layerID,
                    bounds: instanceBounds
                )
            )
            resolvedBounds.include(instanceBounds)
        }
        return CADScene(
            rootGeometry: rootGeometry,
            rootFills: rootFills,
            rootAnnotations: rootAnnotations,
            blockDefinitions: resolvedDefinitions,
            blockInstances: resolvedInstances,
            bounds: resolvedBounds,
            layerIDs: sceneLayerIDs.sorted(),
            layers: sceneLayerIDs.sorted().map {
                sceneLayers[$0] ?? CADLayer(id: $0, name: "Layer \($0)")
            }
        )
    }
}

private extension Array {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
