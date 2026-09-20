import XCTest
@testable import LiteCADCore

final class SceneEditingTests: XCTestCase {
    func testRootLineMoveDuplicateAndDeletePreserveStyle() throws {
        let scene = try makeScene()
        let selection = CADSelectionResult(
            kind: .line,
            point: CADPoint(x: 1, y: 0),
            distance: 0,
            layerID: 4,
            lineIndex: 0
        )

        let moved = try XCTUnwrap(CADSceneEditor.move(
            scene: scene,
            selection: selection,
            delta: CADPoint(x: 10, y: 5)
        ))
        XCTAssertEqual(moved.rootGeometry.segment(at: 0)?.start, CADPoint(x: 10, y: 5))
        XCTAssertEqual(moved.rootGeometry.segment(at: 0)?.end, CADPoint(x: 12, y: 5))
        XCTAssertEqual(moved.rootGeometry.segment(at: 0)?.colorIndex, 2)

        let copied = try XCTUnwrap(CADSceneEditor.duplicate(
            scene: moved,
            selection: selection,
            offset: CADPoint(x: 0, y: 10)
        ))
        XCTAssertEqual(copied.rootGeometry.lineCount, 2)
        XCTAssertEqual(copied.rootGeometry.segment(at: 1)?.start, CADPoint(x: 10, y: 15))

        let deleted = try XCTUnwrap(CADSceneEditor.delete(scene: copied, selection: selection))
        XCTAssertEqual(deleted.rootGeometry.lineCount, 1)
        XCTAssertEqual(deleted.rootGeometry.segment(at: 0)?.start, CADPoint(x: 10, y: 15))
    }

    func testBlockEditingChangesInstanceNotSharedDefinition() throws {
        var geometry = CADLineBuffer()
        try geometry.append(CADLineSegment(
            start: CADPoint(x: 0, y: 0),
            end: CADPoint(x: 2, y: 0)
        ))
        let builder = CADSceneBuilder()
        let definitionID = try builder.addBlockDefinition(name: "UNIT", geometry: geometry)
        try builder.appendBlockInstance(definitionID: definitionID, transform: .translation(x: 10, y: 0))
        try builder.appendBlockInstance(definitionID: definitionID, transform: .translation(x: 20, y: 0))
        let scene = builder.build()
        let selection = CADSelectionResult(
            kind: .line,
            point: CADPoint(x: 10, y: 0),
            distance: 0,
            layerID: 0,
            lineIndex: 0,
            definitionID: definitionID,
            instanceIndex: 0
        )

        let moved = try XCTUnwrap(CADSceneEditor.move(
            scene: scene,
            selection: selection,
            delta: CADPoint(x: 5, y: 3)
        ))
        XCTAssertEqual(moved.blockDefinitions[definitionID].geometry.lineCount, 1)
        XCTAssertEqual(moved.blockInstances.count, 2)
        XCTAssertEqual(moved.blockInstances[0].transform.tx, 15, accuracy: 0.0001)
        XCTAssertEqual(moved.blockInstances[0].transform.ty, 3, accuracy: 0.0001)
        XCTAssertEqual(moved.blockInstances[1].transform.tx, 20, accuracy: 0.0001)

        let copied = try XCTUnwrap(CADSceneEditor.duplicate(
            scene: moved,
            selection: selection,
            offset: CADPoint(x: 0, y: 10)
        ))
        XCTAssertEqual(copied.blockInstances.count, 3)
        XCTAssertEqual(copied.blockInstances[2].transform.tx, 15, accuracy: 0.0001)
        XCTAssertEqual(copied.blockInstances[2].transform.ty, 13, accuracy: 0.0001)
    }

    func testEditHistorySupportsUndoAndRedo() throws {
        let first = try makeScene()
        let second = try XCTUnwrap(CADSceneEditor.duplicate(
            scene: first,
            selection: CADSelectionResult(
                kind: .line,
                point: CADPoint(x: 1, y: 0),
                distance: 0,
                layerID: 4,
                lineIndex: 0
            ),
            offset: CADPoint(x: 0, y: 5)
        ))
        var history = CADEditHistory()
        history.record(before: first)
        XCTAssertEqual(history.undo(current: second), first)
        XCTAssertEqual(history.redo(current: first), second)
    }

    func testEditOperationCanBeSerializedAndReplayed() throws {
        let scene = try makeScene()
        let selection = CADSelectionResult(
            kind: .line,
            point: CADPoint(x: 1, y: 0),
            distance: 0,
            layerID: 4,
            lineIndex: 0
        )
        let operation = CADEditOperation(
            kind: .move,
            selection: CADSelectionDescriptor(selection: selection),
            deltaX: 4,
            deltaY: 6
        )
        let data = try JSONEncoder().encode([operation])
        let restored = try JSONDecoder().decode([CADEditOperation].self, from: data)
        let edited = try XCTUnwrap(restored[0].applying(to: scene))

        XCTAssertEqual(edited.rootGeometry.segment(at: 0)?.start, CADPoint(x: 4, y: 6))
    }

    func testEditJournalResolvesTargetsAfterEarlierDelete() throws {
        let builder = CADSceneBuilder()
        try builder.appendRootLine(CADLineSegment(
            start: CADPoint(x: 0, y: 0), end: CADPoint(x: 2, y: 0)
        ))
        try builder.appendRootLine(CADLineSegment(
            start: CADPoint(x: 10, y: 0), end: CADPoint(x: 12, y: 0)
        ))
        let scene = builder.build()
        let firstSelection = CADSelectionResult(
            kind: .line,
            point: CADPoint(x: 1, y: 0),
            distance: 0,
            layerID: 0,
            lineIndex: 0
        )
        let firstOperation = CADEditOperation(
            kind: .delete,
            selection: CADSelectionDescriptor(selection: firstSelection, in: scene)
        )
        let afterDelete = try XCTUnwrap(firstOperation.applying(to: scene))
        let secondSelection = CADSelectionResult(
            kind: .line,
            point: CADPoint(x: 11, y: 0),
            distance: 0,
            layerID: 0,
            lineIndex: 0
        )
        let secondOperation = CADEditOperation(
            kind: .move,
            selection: CADSelectionDescriptor(selection: secondSelection, in: afterDelete),
            deltaX: 4,
            deltaY: 6
        )

        let data = try JSONEncoder().encode([firstOperation, secondOperation])
        let restored = try JSONDecoder().decode([CADEditOperation].self, from: data)
        var replayed = scene
        for operation in restored {
            replayed = try XCTUnwrap(operation.applying(to: replayed))
        }

        XCTAssertEqual(replayed.rootGeometry.lineCount, 1)
        XCTAssertEqual(replayed.rootGeometry.segment(at: 0)?.start, CADPoint(x: 14, y: 6))
    }

    func testRootTextAndHatchEditingPreserveMetadata() throws {
        let builder = CADSceneBuilder()
        builder.appendRootAnnotation(CADTextAnnotation(
            text: "机房",
            position: CADPoint(x: 1, y: 2),
            height: 3,
            layerID: 4,
            kind: .mtext
        ))
        builder.appendRootFill(CADFillPolygon(
            points: [
                CADPoint(x: 0, y: 0), CADPoint(x: 4, y: 0),
                CADPoint(x: 4, y: 4), CADPoint(x: 0, y: 4)
            ],
            layerID: 4,
            colorIndex: 7
        ))
        let scene = builder.build()

        let textSelection = CADSelectionResult(
            kind: .text,
            point: CADPoint(x: 1, y: 2),
            distance: 0,
            layerID: 4,
            annotationIndex: 0,
            text: "机房"
        )
        let movedText = try XCTUnwrap(CADSceneEditor.move(
            scene: scene,
            selection: textSelection,
            delta: CADPoint(x: 10, y: 5)
        ))
        XCTAssertEqual(movedText.rootAnnotations[0].position, CADPoint(x: 11, y: 7))
        XCTAssertEqual(movedText.rootAnnotations[0].kind, .mtext)

        let fillSelection = CADSelectionResult(
            kind: .fill,
            point: CADPoint(x: 2, y: 2),
            distance: 0,
            layerID: 4,
            fillIndex: 0
        )
        let rotatedFill = try XCTUnwrap(CADSceneEditor.rotate(
            scene: scene,
            selection: fillSelection,
            radians: .pi / 2,
            center: CADPoint(x: 0, y: 0)
        ))
        XCTAssertEqual(rotatedFill.rootFills[0].colorIndex, 7)
        XCTAssertEqual(rotatedFill.rootFills[0].points[1].x, 0, accuracy: 0.0001)
        XCTAssertEqual(rotatedFill.rootFills[0].points[1].y, 4, accuracy: 0.0001)

        let duplicatedFill = try XCTUnwrap(CADSceneEditor.duplicate(
            scene: scene,
            selection: fillSelection,
            offset: CADPoint(x: 10, y: 0)
        ))
        XCTAssertEqual(duplicatedFill.rootFills.count, 2)
        XCTAssertEqual(duplicatedFill.rootFills[1].points[0], CADPoint(x: 10, y: 0))
    }

    func testHitTestReturnsEditableTextAndHatchTargets() throws {
        let builder = CADSceneBuilder()
        builder.appendRootAnnotation(CADTextAnnotation(
            text: "标注",
            position: CADPoint(x: 10, y: 10),
            height: 2
        ))
        builder.appendRootFill(CADFillPolygon(points: [
            CADPoint(x: 0, y: 0), CADPoint(x: 4, y: 0),
            CADPoint(x: 4, y: 4), CADPoint(x: 0, y: 4)
        ]))
        let scene = builder.build()

        let fillSelection = try XCTUnwrap(scene.hitTest(
            near: CADPoint(x: 2, y: 2),
            tolerance: 0.1
        ))
        XCTAssertEqual(fillSelection.kind, .fill)
        XCTAssertEqual(fillSelection.fillIndex, 0)

        let textSelection = try XCTUnwrap(scene.hitTest(
            near: CADPoint(x: 10, y: 10),
            tolerance: 0.1
        ))
        XCTAssertEqual(textSelection.kind, .text)
        XCTAssertEqual(textSelection.annotationIndex, 0)
    }

    private func makeScene() throws -> CADScene {
        let builder = CADSceneBuilder()
        builder.registerLayer(CADLayer(id: 4, name: "WALL", colorIndex: 2))
        try builder.appendRootLine(CADLineSegment(
            start: CADPoint(x: 0, y: 0),
            end: CADPoint(x: 2, y: 0),
            layerID: 4,
            colorIndex: 2
        ))
        return builder.build()
    }
}
