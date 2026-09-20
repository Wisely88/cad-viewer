import XCTest
@testable import LiteCADCore

final class ViewportTests: XCTestCase {
    func testInvalidZoomDoesNotCorruptViewport() {
        var viewport = CADViewportState(
            center: CADPoint(x: 2, y: 3),
            scale: 4,
            viewportSize: CADPoint(x: 100, y: 100)
        )

        viewport.zoom(factor: .nan, anchorScreenX: 50, anchorScreenY: 50)
        viewport.zoom(factor: 0, anchorScreenX: 50, anchorScreenY: 50)

        XCTAssertEqual(viewport.center, CADPoint(x: 2, y: 3))
        XCTAssertEqual(viewport.scale, 4)
    }
}
