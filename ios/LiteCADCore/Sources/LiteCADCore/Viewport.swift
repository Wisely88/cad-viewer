import Foundation

public struct CADMeasurement: Equatable, Sendable {
    public let start: CADPoint
    public let end: CADPoint
    public let distance: Float

    public var deltaX: Float { end.x - start.x }
    public var deltaY: Float { end.y - start.y }
    public var angleDegrees: Float { atan2(deltaY, deltaX) * 180 / .pi }

    public init(start: CADPoint, end: CADPoint) {
        self.start = start
        self.end = end
        distance = hypot(end.x - start.x, end.y - start.y)
    }
}

public struct CADPathMeasurement: Equatable, Sendable {
    public let points: [CADPoint]

    public init(points: [CADPoint]) {
        self.points = points
    }

    public var totalDistance: Float {
        guard points.count >= 2 else { return 0 }
        return zip(points, points.dropFirst()).reduce(0) { total, pair in
            total + hypot(pair.1.x - pair.0.x, pair.1.y - pair.0.y)
        }
    }
}

public struct CADCircleMeasurement: Equatable, Sendable {
    public let points: [CADPoint]
    public let center: CADPoint
    public let radius: Float

    public var diameter: Float { radius * 2 }
    public var circumference: Float { radius * 2 * .pi }

    public init?(points: [CADPoint]) {
        guard points.count == 3,
              points.allSatisfy({ $0.x.isFinite && $0.y.isFinite }) else { return nil }
        let a = points[0]
        let b = points[1]
        let c = points[2]
        let denominator = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y))
        guard abs(denominator) > 0.000_001 else { return nil }

        let aSquared = a.x * a.x + a.y * a.y
        let bSquared = b.x * b.x + b.y * b.y
        let cSquared = c.x * c.x + c.y * c.y
        let center = CADPoint(
            x: (aSquared * (b.y - c.y) + bSquared * (c.y - a.y) + cSquared * (a.y - b.y)) / denominator,
            y: (aSquared * (c.x - b.x) + bSquared * (a.x - c.x) + cSquared * (b.x - a.x)) / denominator
        )
        let radius = hypot(center.x - a.x, center.y - a.y)
        guard center.x.isFinite, center.y.isFinite, radius.isFinite, radius > 0 else { return nil }
        self.points = points
        self.center = center
        self.radius = radius
    }
}

public struct CADAreaMeasurement: Equatable, Sendable {
    public let points: [CADPoint]

    public init(points: [CADPoint]) { self.points = points }

    public var area: Float {
        guard points.count >= 3 else { return 0 }
        var sum: Float = 0
        for index in points.indices {
            let next = points[(index + 1) % points.count]
            sum += points[index].x * next.y - next.x * points[index].y
        }
        return abs(sum) / 2
    }
}

public struct CADAngleMeasurement: Equatable, Sendable {
    public let start: CADPoint
    public let vertex: CADPoint
    public let end: CADPoint

    public init(start: CADPoint, vertex: CADPoint, end: CADPoint) {
        self.start = start
        self.vertex = vertex
        self.end = end
    }

    public var degrees: Float {
        let a = CADPoint(x: start.x - vertex.x, y: start.y - vertex.y)
        let b = CADPoint(x: end.x - vertex.x, y: end.y - vertex.y)
        let denominator = max(hypot(a.x, a.y) * hypot(b.x, b.y), 0.000_001)
        let cosine = min(max((a.x * b.x + a.y * b.y) / denominator, -1), 1)
        return acos(cosine) * 180 / .pi
    }
}

public struct CADViewportState: Equatable, Sendable {
    public private(set) var center: CADPoint
    public private(set) var scale: Float
    public private(set) var viewportSize: CADPoint

    public init(
        center: CADPoint = CADPoint(x: 0, y: 0),
        scale: Float = 1,
        viewportSize: CADPoint = CADPoint(x: 1, y: 1)
    ) {
        self.center = center
        self.scale = max(scale, 0.000_001)
        self.viewportSize = CADPoint(
            x: max(viewportSize.x, 1),
            y: max(viewportSize.y, 1)
        )
    }

    public mutating func setViewportSize(width: Float, height: Float) {
        viewportSize = CADPoint(x: max(width, 1), y: max(height, 1))
    }

    /// Fits the scene while preserving aspect ratio and leaving a symmetric margin.
    public mutating func fit(
        bounds: CADRect,
        padding: Float = 0.90,
        minimumScale: Float = 0.000_001
    ) {
        guard !bounds.isEmpty else { return }

        center = CADPoint(
            x: (bounds.minX + bounds.maxX) / 2,
            y: (bounds.minY + bounds.maxY) / 2
        )

        let safePadding = min(max(padding, 0.1), 1)
        let worldWidth = max(bounds.width, 0.000_001)
        let worldHeight = max(bounds.height, 0.000_001)
        let pixelsPerWorldUnit = min(viewportSize.x / worldWidth, viewportSize.y / worldHeight)
        scale = max(pixelsPerWorldUnit * safePadding, minimumScale)
    }

    /// Positive screen deltas move the drawing with the user's finger.
    public mutating func pan(screenDeltaX: Float, screenDeltaY: Float) {
        center = CADPoint(
            x: center.x - screenDeltaX / scale,
            y: center.y + screenDeltaY / scale
        )
    }

    public mutating func focus(on point: CADPoint) {
        guard point.x.isFinite, point.y.isFinite else { return }
        center = point
    }

    /// Zooms around a screen-space anchor so the world point under the finger stays fixed.
    public mutating func zoom(
        factor: Float,
        anchorScreenX: Float,
        anchorScreenY: Float,
        minimumScale: Float = 0.000_001,
        maximumScale: Float = 1_000_000
    ) {
        guard factor.isFinite, factor > 0 else { return }

        let oldScale = scale
        let nextScale = min(max(oldScale * factor, minimumScale), maximumScale)
        guard nextScale != oldScale else { return }

        let worldBefore = worldPoint(screenX: anchorScreenX, screenY: anchorScreenY)
        scale = nextScale
        let worldAfter = worldPoint(screenX: anchorScreenX, screenY: anchorScreenY)
        center = CADPoint(
            x: center.x + worldBefore.x - worldAfter.x,
            y: center.y + worldBefore.y - worldAfter.y
        )
    }

    public func worldPoint(screenX: Float, screenY: Float) -> CADPoint {
        CADPoint(
            x: center.x + (screenX - viewportSize.x / 2) / scale,
            y: center.y - (screenY - viewportSize.y / 2) / scale
        )
    }

    public func visibleWorldBounds() -> CADRect {
        let halfWidth = viewportSize.x / (2 * scale)
        let halfHeight = viewportSize.y / (2 * scale)
        return CADRect(
            minX: center.x - halfWidth,
            minY: center.y - halfHeight,
            maxX: center.x + halfWidth,
            maxY: center.y + halfHeight
        )
    }

    public func visibleBlockInstances(in scene: CADScene) -> [CADBlockInstance] {
        let visibleBounds = visibleWorldBounds()
        return scene.blockInstances.filter { $0.bounds.intersects(visibleBounds) }
    }
}
