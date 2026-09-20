import XCTest
@testable import LiteCADCore

final class SceneGraphTests: XCTestCase {
    func testBlockDefinitionIsStoredOnceWhileInstancesRemainIndependent() throws {
        var geometry = CADLineBuffer()
        try geometry.append(
            CADLineSegment(
                start: CADPoint(x: 0, y: 0),
                end: CADPoint(x: 2, y: 1),
                layerID: 7
            )
        )

        let builder = CADSceneBuilder()
        let definitionID = try builder.addBlockDefinition(name: "BOLT", geometry: geometry)
        try builder.appendBlockInstance(
            definitionID: definitionID,
            transform: .translation(x: 10, y: 20),
            layerID: 3
        )
        try builder.appendBlockInstance(
            definitionID: definitionID,
            transform: .translation(x: -4, y: 5),
            layerID: 4
        )

        let scene = builder.build()

        XCTAssertEqual(scene.blockDefinitions.count, 1)
        XCTAssertEqual(scene.blockInstances.count, 2)
        XCTAssertEqual(scene.storedLineCount, 1)
        XCTAssertEqual(scene.instanceLineCount, 2)
        XCTAssertEqual(scene.layerIDs, [3, 4, 7])
        XCTAssertEqual(scene.blockInstances[0].bounds, CADRect(minX: 10, minY: 20, maxX: 12, maxY: 21))
        XCTAssertEqual(scene.blockInstances[1].bounds, CADRect(minX: -4, minY: 5, maxX: -2, maxY: 6))
        XCTAssertEqual(scene.bounds, CADRect(minX: -4, minY: 5, maxX: 12, maxY: 21))
    }

    func testNestedTransformsComposeInExpectedOrder() {
        let translate = CADTransform2D.translation(x: 10, y: 2)
        let scale = CADTransform2D(a: 2, b: 0, c: 0, d: 2, tx: 0, ty: 0)
        let result = translate.concatenating(scale).applying(to: CADPoint(x: 3, y: 4))

        XCTAssertEqual(result, CADPoint(x: 16, y: 10))
    }

    func testInvalidInputDoesNotEnterPackedBuffer() {
        var geometry = CADLineBuffer()

        XCTAssertThrowsError(
            try geometry.append(
                CADLineSegment(
                    start: CADPoint(x: .nan, y: 0),
                    end: CADPoint(x: 1, y: 1)
                )
            )
        ) { error in
            XCTAssertEqual(error as? SceneGraphError, .nonFiniteCoordinate)
        }
        XCTAssertTrue(geometry.isEmpty)
    }

    func testUnknownBlockInstanceIsRejected() {
        let builder = CADSceneBuilder()

        XCTAssertThrowsError(try builder.appendBlockInstance(definitionID: 99)) { error in
            XCTAssertEqual(error as? SceneGraphError, .missingBlockDefinition(99))
        }
    }

    func testRealisticInsertCountDoesNotDuplicateBlockGeometry() throws {
        var geometry = CADLineBuffer()
        try geometry.append(
            CADLineSegment(
                start: CADPoint(x: -1, y: -1),
                end: CADPoint(x: 1, y: 1)
            )
        )

        let builder = CADSceneBuilder()
        let definitionID = try builder.addBlockDefinition(name: "FACTORY_UNIT", geometry: geometry)
        for index in 0..<3_542 {
            try builder.appendBlockInstance(
                definitionID: definitionID,
                transform: .translation(x: Float(index % 100), y: Float(index / 100))
            )
        }

        let scene = builder.build()

        XCTAssertEqual(scene.blockInstances.count, 3_542)
        XCTAssertEqual(scene.storedLineCount, 1)
        XCTAssertEqual(scene.instanceLineCount, 3_542)
    }

    func testNestedBlockInstancesRemainCompactAndExpandBounds() throws {
        var childGeometry = CADLineBuffer()
        try childGeometry.append(
            CADLineSegment(start: CADPoint(x: 0, y: 0), end: CADPoint(x: 2, y: 1))
        )

        let builder = CADSceneBuilder()
        let childID = try builder.addBlockDefinition(name: "CHILD", geometry: childGeometry)
        var parentGeometry = CADLineBuffer()
        try parentGeometry.append(
            CADLineSegment(start: CADPoint(x: 0, y: 0), end: CADPoint(x: 1, y: 0))
        )
        let parentID = try builder.addBlockDefinition(
            name: "PARENT",
            geometry: parentGeometry,
            nestedInstances: [
                CADNestedBlockInstance(
                    definitionID: childID,
                    transform: .translation(x: 10, y: 20)
                )
            ]
        )
        try builder.appendBlockInstance(
            definitionID: parentID,
            transform: .translation(x: 100, y: 200)
        )

        let scene = builder.build()

        XCTAssertEqual(scene.storedLineCount, 2)
        XCTAssertEqual(scene.blockDefinitions[parentID].nestedInstances.count, 1)
        XCTAssertEqual(
            scene.blockInstances[0].bounds,
            CADRect(minX: 100, minY: 200, maxX: 112, maxY: 221)
        )
    }

    func testViewportFitPanAndAnchorZoomPreserveWorldPoint() throws {
        var viewport = CADViewportState(viewportSize: CADPoint(x: 1_000, y: 500))
        let bounds = CADRect(minX: -100, minY: -50, maxX: 100, maxY: 50)

        viewport.fit(bounds: bounds)
        XCTAssertEqual(viewport.center, CADPoint(x: 0, y: 0))
        XCTAssertEqual(viewport.scale, 4.5, accuracy: 0.000_1)

        let worldAtAnchor = viewport.worldPoint(screenX: 750, screenY: 200)
        viewport.zoom(factor: 2, anchorScreenX: 750, anchorScreenY: 200)
        XCTAssertEqual(viewport.worldPoint(screenX: 750, screenY: 200), worldAtAnchor)

        viewport.pan(screenDeltaX: 45, screenDeltaY: -30)
        XCTAssertEqual(viewport.center.x, 22.777_778, accuracy: 0.000_1)
        XCTAssertEqual(viewport.center.y, 2.222_222, accuracy: 0.000_1)
    }

    func testViewportCullsBlockInstancesByBounds() throws {
        var geometry = CADLineBuffer()
        try geometry.append(
            CADLineSegment(start: CADPoint(x: 0, y: 0), end: CADPoint(x: 1, y: 1))
        )

        let builder = CADSceneBuilder()
        let definitionID = try builder.addBlockDefinition(name: "UNIT", geometry: geometry)
        try builder.appendBlockInstance(definitionID: definitionID, transform: .translation(x: 0, y: 0))
        try builder.appendBlockInstance(definitionID: definitionID, transform: .translation(x: 10_000, y: 10_000))
        let scene = builder.build()

        var viewport = CADViewportState(viewportSize: CADPoint(x: 100, y: 100))
        viewport.fit(bounds: CADRect(minX: -1, minY: -1, maxX: 2, maxY: 2))

        XCTAssertEqual(viewport.visibleBlockInstances(in: scene).count, 1)
    }

    func testMeasurementUsesWorldCoordinates() {
        let measurement = CADMeasurement(
            start: CADPoint(x: 10, y: 20),
            end: CADPoint(x: 13, y: 24)
        )

        XCTAssertEqual(measurement.distance, 5, accuracy: 0.000_1)
        XCTAssertEqual(measurement.deltaX, 3, accuracy: 0.000_1)
        XCTAssertEqual(measurement.deltaY, 4, accuracy: 0.000_1)
        XCTAssertEqual(measurement.angleDegrees, 53.1301, accuracy: 0.001)
    }

    func testAreaAndAngleMeasurementUseWorldCoordinates() {
        let area = CADAreaMeasurement(points: [
            CADPoint(x: 0, y: 0), CADPoint(x: 4, y: 0), CADPoint(x: 4, y: 3)
        ])
        XCTAssertEqual(area.area, 6, accuracy: 0.000_1)

        let angle = CADAngleMeasurement(
            start: CADPoint(x: 1, y: 0),
            vertex: CADPoint(x: 0, y: 0),
            end: CADPoint(x: 0, y: 1)
        )
        XCTAssertEqual(angle.degrees, 90, accuracy: 0.000_1)
    }

    func testContinuousPathMeasurementSumsSegments() {
        let path = CADPathMeasurement(points: [
            CADPoint(x: 0, y: 0),
            CADPoint(x: 3, y: 4),
            CADPoint(x: 3, y: 8)
        ])

        XCTAssertEqual(path.totalDistance, 9, accuracy: 0.000_1)
    }

    func testThreePointCircleMeasurementReturnsRadiusDiameterAndCircumference() {
        let measurement = CADCircleMeasurement(points: [
            CADPoint(x: 5, y: 0),
            CADPoint(x: 0, y: 5),
            CADPoint(x: -5, y: 0)
        ])

        XCTAssertEqual(measurement?.center, CADPoint(x: 0, y: 0))
        XCTAssertEqual(measurement?.radius ?? 0, 5, accuracy: 0.000_1)
        XCTAssertEqual(measurement?.diameter ?? 0, 10, accuracy: 0.000_1)
        XCTAssertEqual(measurement?.circumference ?? 0, 10 * .pi, accuracy: 0.000_1)
        XCTAssertNil(CADCircleMeasurement(points: [
            CADPoint(x: 0, y: 0), CADPoint(x: 1, y: 1), CADPoint(x: 2, y: 2)
        ]))
    }

    func testTextMatchesSearchesRootAndTransformedBlockAnnotations() throws {
        let builder = CADSceneBuilder()
        builder.appendRootAnnotation(CADTextAnnotation(
            text: "PUMP-01",
            position: CADPoint(x: 2, y: 3),
            height: 1,
            layerID: 4
        ))
        let definitionID = try builder.addBlockDefinition(
            name: "LABEL",
            geometry: CADLineBuffer(),
            annotations: [CADTextAnnotation(
                text: "VALVE-A",
                position: CADPoint(x: 1, y: 2),
                height: 1,
                layerID: 8,
                kind: .mtext
            )]
        )
        try builder.appendBlockInstance(
            definitionID: definitionID,
            transform: .translation(x: 10, y: 20)
        )

        let matches = builder.build().textMatches(query: "valve")

        XCTAssertEqual(matches.count, 1)
        XCTAssertEqual(matches[0].text, "VALVE-A")
        XCTAssertEqual(matches[0].point, CADPoint(x: 11, y: 22))
        XCTAssertEqual(matches[0].kind, .mtext)
    }

    func testLayerMetadataAndHitTestRemainVisible() throws {
        let builder = CADSceneBuilder()
        builder.registerLayer(CADLayer(
            id: 4,
            name: "WALL",
            colorRGB: 0x3366cc,
            lineWeight: 35,
            linePattern: .dashed
        ))
        try builder.appendRootLine(CADLineSegment(
            start: CADPoint(x: 0, y: 0), end: CADPoint(x: 10, y: 0), layerID: 4
        ))
        let scene = builder.build()

        XCTAssertEqual(scene.layers.first?.name, "WALL")
        XCTAssertEqual(scene.layers.first?.lineWeight, 35)
        XCTAssertEqual(scene.layers.first?.linePattern, .dashed)
        let hit = scene.hitTest(near: CADPoint(x: 3, y: 0.1), tolerance: 0.2)
        XCTAssertEqual(hit?.kind, .line)
        XCTAssertEqual(hit?.layerID, 4)
        XCTAssertEqual(hit?.point.x ?? -1, 3, accuracy: 0.000_1)
    }

    func testFillPolygonContributesToSceneBoundsAndLayerIDs() throws {
        let builder = CADSceneBuilder()
        let fill = CADFillPolygon(
            points: [
                CADPoint(x: 20, y: 30),
                CADPoint(x: 24, y: 30),
                CADPoint(x: 24, y: 34),
                CADPoint(x: 20, y: 34)
            ],
            layerID: 9,
            colorIndex: 2
        )
        builder.appendRootFill(fill)

        let scene = builder.build()

        XCTAssertEqual(scene.rootFills, [fill])
        XCTAssertTrue(scene.layerIDs.contains(9))
        XCTAssertEqual(scene.bounds, CADRect(minX: 20, minY: 30, maxX: 24, maxY: 34))
        XCTAssertEqual(scene.focusBounds, scene.bounds)
    }

    func testSnapPointPrefersExactEndpointAndSupportsBlockTransforms() throws {
        var rootGeometry = CADLineBuffer()
        try rootGeometry.append(
            CADLineSegment(
                start: CADPoint(x: 0, y: 0),
                end: CADPoint(x: 10, y: 0)
            )
        )
        let builder = CADSceneBuilder()
        try builder.appendRootLine(
            CADLineSegment(
                start: CADPoint(x: 0, y: 0),
                end: CADPoint(x: 10, y: 0)
            )
        )
        let definitionID = try builder.addBlockDefinition(name: "UNIT", geometry: rootGeometry)
        try builder.appendBlockInstance(
            definitionID: definitionID,
            transform: .translation(x: 100, y: 50)
        )
        let scene = builder.build()

        let endpoint = scene.snapPoint(
            near: CADPoint(x: 0.2, y: 0.1),
            tolerance: 0.5
        )
        XCTAssertEqual(endpoint?.point, CADPoint(x: 0, y: 0))
        XCTAssertEqual(endpoint?.kind, .endpoint)

        let transformed = scene.snapPoint(
            near: CADPoint(x: 104.9, y: 50.2),
            tolerance: 0.5
        )
        XCTAssertEqual(transformed?.point, CADPoint(x: 105, y: 50))
        XCTAssertEqual(transformed?.kind, .midpoint)
    }

    func testFocusBoundsRejectsRemoteGeometryOutlier() throws {
        let builder = CADSceneBuilder()
        for index in 0..<30 {
            let x = Float(index % 10)
            let y = Float(index / 10)
            try builder.appendRootLine(
                CADLineSegment(
                    start: CADPoint(x: x, y: y),
                    end: CADPoint(x: x + 1, y: y)
                )
            )
        }
        try builder.appendRootLine(
            CADLineSegment(
                start: CADPoint(x: 100_000, y: 100_000),
                end: CADPoint(x: 100_001, y: 100_000)
            )
        )

        let scene = builder.build()

        XCTAssertEqual(scene.bounds.maxX, 100_001, accuracy: 0.001)
        XCTAssertLessThan(scene.focusBounds.maxX, 100)
        XCTAssertLessThan(scene.focusBounds.maxY, 100)
    }

    func testTextAnnotationPreservesBlockTransformAndLayer() throws {
        let annotation = CADTextAnnotation(
            text: "A1",
            position: CADPoint(x: 2, y: 3),
            height: 4,
            rotation: 0.25,
            widthFactor: 0.8,
            layerID: 9,
            kind: .mtext,
            horizontalAlignment: 1,
            verticalAlignment: 2,
            attachment: 5
        )
        var geometry = CADLineBuffer()
        try geometry.append(
            CADLineSegment(start: CADPoint(x: 0, y: 0), end: CADPoint(x: 1, y: 1), layerID: 2)
        )

        let builder = CADSceneBuilder()
        let definitionID = try builder.addBlockDefinition(
            name: "LABEL",
            geometry: geometry,
            annotations: [annotation]
        )
        try builder.appendBlockInstance(
            definitionID: definitionID,
            transform: CADTransform2D(a: 0, b: 2, c: -2, d: 0, tx: 10, ty: 20),
            layerID: 3
        )
        let scene = builder.build()

        let transformed = scene.blockDefinitions[0].annotations[0].transformed(
            by: scene.blockInstances[0].transform
        )
        XCTAssertEqual(transformed.position, CADPoint(x: 4, y: 24))
        XCTAssertEqual(transformed.height, 8, accuracy: 0.000_1)
        XCTAssertEqual(transformed.layerID, 9)
        XCTAssertEqual(transformed.kind, .mtext)
        XCTAssertEqual(transformed.horizontalAlignment, 1)
        XCTAssertEqual(transformed.verticalAlignment, 2)
        XCTAssertEqual(transformed.attachment, 5)
        XCTAssertEqual(scene.layerIDs, [2, 3, 9])
    }
}
