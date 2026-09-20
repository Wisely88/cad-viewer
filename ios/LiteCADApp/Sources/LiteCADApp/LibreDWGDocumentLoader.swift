#if LITECAD_LIBREDWG_ENABLED
import Foundation
import LiteCADCore

private final class LibreDWGSceneCollector: @unchecked Sendable {
    struct Instance {
        let definitionID: UInt32
        let transform: CADTransform2D
        let layerID: UInt16
    }

    final class Definition {
        var name: String
        var geometry = CADLineBuffer()
        var fills: [CADFillPolygon] = []
        var annotations: [CADTextAnnotation] = []
        var nestedInstances: [Instance] = []

        init(name: String) {
            self.name = name
        }
    }

    var definitions: [UInt32: Definition] = [:]
    var layers: [UInt16: CADLayer] = [:]
    var rootGeometry = CADLineBuffer()
    var rootFills: [CADFillPolygon] = []
    var rootAnnotations: [CADTextAnnotation] = []
    var rootInstances: [Instance] = []
    var activeDefinitionID: UInt32?
    var callbackError: Error?
    var ignoredNestedBlockCount = 0

    func append(_ line: LiteCADLine, to definitionID: UInt32?) {
        let segment = CADLineSegment(
            start: CADPoint(x: line.start.x, y: line.start.y),
            end: CADPoint(x: line.end.x, y: line.end.y),
            layerID: line.layer_id,
            colorRGB: line.color_rgb,
            colorIndex: line.color_index
        )

        do {
            if let definitionID {
                guard let definition = definitions[definitionID] else {
                    throw CADDocumentLoaderError.bridgeFailed("LibreDWG 返回了未知的 BLOCK 定义。")
                }
                try definition.geometry.append(segment)
            } else {
                try rootGeometry.append(segment)
            }
        } catch {
            callbackError = error
        }
    }

    func append(_ annotation: LiteCADTextAnnotation, to definitionID: UInt32?) {
        guard let textPointer = annotation.text else { return }
        let text = decodeDWGText(textPointer)
        guard !text.isEmpty else { return }
        let value = CADTextAnnotation(
            text: text,
            position: CADPoint(x: annotation.position.x, y: annotation.position.y),
            height: annotation.height,
            rotation: annotation.rotation,
            widthFactor: annotation.width_factor,
            layerID: annotation.layer_id,
            kind: CADTextKind(rawValue: UInt8(annotation.kind.rawValue)) ?? .text,
            horizontalAlignment: annotation.horizontal_alignment,
            verticalAlignment: annotation.vertical_alignment,
            attachment: annotation.attachment
        )
        if let definitionID {
            definitions[definitionID]?.annotations.append(value)
        } else {
            rootAnnotations.append(value)
        }
    }

    func append(_ fill: LiteCADFillPolygon, to definitionID: UInt32?) {
        guard fill.point_count >= 3, let points = fill.points else { return }
        let value = CADFillPolygon(
            points: (0..<Int(fill.point_count)).map { index in
                CADPoint(x: points[index].x, y: points[index].y)
            },
            layerID: fill.layer_id,
            colorRGB: fill.color_rgb,
            colorIndex: fill.color_index,
            isHole: fill.is_hole != 0
        )
        if let definitionID {
            definitions[definitionID]?.fills.append(value)
        } else {
            rootFills.append(value)
        }
    }

    func append(_ layer: LiteCADLayer) {
        let name = layer.name.map(String.init(cString:)) ?? ""
        layers[layer.id] = CADLayer(
            id: layer.id,
            name: name.isEmpty ? "Layer \(layer.id)" : name,
            colorIndex: layer.color_index,
            colorRGB: layer.color_rgb,
            lineWeight: layer.line_weight,
            linePattern: CADLinePattern(rawValue: layer.line_type) ?? .solid
        )
    }

    func makeScene() throws -> CADScene {
        if let callbackError {
            throw callbackError
        }

        let builder = CADSceneBuilder()
        let sourceDefinitionIDs = definitions.keys.sorted()
        // LibreDWG exposes the source object's BLOCK_RECORD/object ID. The
        // scene graph stores definitions in a dense Swift array, so every
        // INSERT (including nested INSERTs) must use the same remapping.
        let definitionIDMap = Dictionary(
            uniqueKeysWithValues: sourceDefinitionIDs.enumerated().map { index, sourceID in
                (sourceID, index)
            }
        )
        for sourceDefinitionID in sourceDefinitionIDs {
            guard let definition = definitions[sourceDefinitionID] else { continue }
            let name = definition.name.trimmingCharacters(in: .whitespacesAndNewlines)
            let nestedInstances = try definition.nestedInstances.map { nested in
                guard let mappedID = definitionIDMap[nested.definitionID] else {
                    throw CADDocumentLoaderError.bridgeFailed(
                        "BLOCK \(sourceDefinitionID) 引用了缺失的 BLOCK \(nested.definitionID)。"
                    )
                }
                return CADNestedBlockInstance(
                    definitionID: mappedID,
                    transform: nested.transform,
                    layerID: nested.layerID
                )
            }
            _ = try builder.addBlockDefinition(
                name: name.isEmpty ? "BLOCK \(sourceDefinitionID)" : name,
                geometry: definition.geometry,
                fills: definition.fills,
                annotations: definition.annotations,
                nestedInstances: nestedInstances
            )
        }

        for index in 0..<rootGeometry.lineCount {
            guard let segment = rootGeometry.segment(at: index) else { continue }
            try builder.appendRootLine(segment)
        }
        for annotation in rootAnnotations {
            builder.appendRootAnnotation(annotation)
        }
        for fill in rootFills {
            builder.appendRootFill(fill)
        }

        for instance in rootInstances {
            guard let mappedID = definitionIDMap[instance.definitionID] else {
                throw CADDocumentLoaderError.bridgeFailed(
                    "模型空间引用了缺失的 BLOCK \(instance.definitionID)。"
                )
            }
            try builder.appendBlockInstance(
                definitionID: mappedID,
                transform: instance.transform,
                layerID: instance.layerID
            )
        }
        for layer in layers.values {
            builder.registerLayer(layer)
        }
        return builder.build()
    }
}

private func decodeDWGText(_ pointer: UnsafePointer<CChar>) -> String {
    let data = Data(bytes: pointer, count: strlen(pointer))
    // The bridge normalizes DWG TEXT/MTEXT/DIMENSION values through
    // LibreDWG's UCS-2-to-UTF-8 conversion before invoking this callback.
    return String(decoding: data, as: UTF8.self)
}

private enum LibreDWGCallbacks {
    static let appendLayer: @convention(c) (
        UnsafeMutableRawPointer?, UnsafePointer<LiteCADLayer>?
    ) -> Void = { context, layer in
        guard let context, let layer else { return }
        let collector = Unmanaged<LibreDWGSceneCollector>
            .fromOpaque(context)
            .takeUnretainedValue()
        collector.append(layer.pointee)
    }

    static let beginBlock: @convention(c) (
        UnsafeMutableRawPointer?, UInt32, UnsafePointer<CChar>?
    ) -> Void = { context, definitionID, name in
        guard let context else { return }
        let collector = Unmanaged<LibreDWGSceneCollector>
            .fromOpaque(context)
            .takeUnretainedValue()
        collector.activeDefinitionID = definitionID
        collector.definitions[definitionID] = LibreDWGSceneCollector.Definition(
            name: name.map(String.init(cString:)) ?? ""
        )
    }

    static let appendLine: @convention(c) (
        UnsafeMutableRawPointer?, UnsafePointer<LiteCADLine>?
    ) -> Void = { context, line in
        guard let context, let line else { return }
        let collector = Unmanaged<LibreDWGSceneCollector>
            .fromOpaque(context)
            .takeUnretainedValue()
        collector.append(line.pointee, to: collector.activeDefinitionID)
    }

    static let appendText: @convention(c) (
        UnsafeMutableRawPointer?, UnsafePointer<LiteCADTextAnnotation>?
    ) -> Void = { context, annotation in
        guard let context, let annotation else { return }
        let collector = Unmanaged<LibreDWGSceneCollector>
            .fromOpaque(context)
            .takeUnretainedValue()
        collector.append(annotation.pointee, to: collector.activeDefinitionID)
    }

    static let appendFill: @convention(c) (
        UnsafeMutableRawPointer?, UnsafePointer<LiteCADFillPolygon>?
    ) -> Void = { context, fill in
        guard let context, let fill else { return }
        let collector = Unmanaged<LibreDWGSceneCollector>
            .fromOpaque(context)
            .takeUnretainedValue()
        collector.append(fill.pointee, to: collector.activeDefinitionID)
    }

    static let endBlock: @convention(c) (
        UnsafeMutableRawPointer?, UInt32
    ) -> Void = { context, _ in
        guard let context else { return }
        let collector = Unmanaged<LibreDWGSceneCollector>
            .fromOpaque(context)
            .takeUnretainedValue()
        collector.activeDefinitionID = nil
    }

    static let appendRootLine: @convention(c) (
        UnsafeMutableRawPointer?, UnsafePointer<LiteCADLine>?
    ) -> Void = { context, line in
        guard let context, let line else { return }
        let collector = Unmanaged<LibreDWGSceneCollector>
            .fromOpaque(context)
            .takeUnretainedValue()
        collector.append(line.pointee, to: nil)
    }

    static let appendRootText: @convention(c) (
        UnsafeMutableRawPointer?, UnsafePointer<LiteCADTextAnnotation>?
    ) -> Void = { context, annotation in
        guard let context, let annotation else { return }
        let collector = Unmanaged<LibreDWGSceneCollector>
            .fromOpaque(context)
            .takeUnretainedValue()
        collector.append(annotation.pointee, to: nil)
    }

    static let appendBlockInstance: @convention(c) (
        UnsafeMutableRawPointer?, UInt32, Float, Float, Float, Float, Float, Float, UInt16
    ) -> Void = { context, definitionID, a, b, c, d, tx, ty, layerID in
        guard let context else { return }
        let collector = Unmanaged<LibreDWGSceneCollector>
            .fromOpaque(context)
            .takeUnretainedValue()
        let instance = LibreDWGSceneCollector.Instance(
            definitionID: definitionID,
            transform: CADTransform2D(a: a, b: b, c: c, d: d, tx: tx, ty: ty),
            layerID: layerID
        )
        if let activeDefinitionID = collector.activeDefinitionID {
            collector.definitions[activeDefinitionID]?.nestedInstances.append(instance)
        } else {
            collector.rootInstances.append(instance)
        }
    }
}

public struct LibreDWGDocumentLoader: CADDocumentLoader {
    public init() {}

    public func load(url: URL) async throws -> CADScene {
        guard url.isFileURL else {
            throw CADDocumentLoaderError.bridgeFailed("DWG 必须来自本地文件。")
        }

        return try await Task.detached(priority: .userInitiated) {
            let collector = LibreDWGSceneCollector()
            let context = Unmanaged.passUnretained(collector).toOpaque()
            var callbacks = LiteCADDocumentCallbacks(
                append_layer: LibreDWGCallbacks.appendLayer,
                append_fill: LibreDWGCallbacks.appendFill,
                begin_block_definition: LibreDWGCallbacks.beginBlock,
                append_line: LibreDWGCallbacks.appendLine,
                append_text: LibreDWGCallbacks.appendText,
                end_block_definition: LibreDWGCallbacks.endBlock,
                append_root_line: LibreDWGCallbacks.appendRootLine,
                append_root_text: LibreDWGCallbacks.appendRootText,
                append_block_instance: LibreDWGCallbacks.appendBlockInstance
            )
            var errorBuffer = [CChar](repeating: 0, count: 512)
            let status = url.path.withCString { path in
                errorBuffer.withUnsafeMutableBufferPointer { buffer in
                    litecad_read_dwg_file(
                        path,
                        &callbacks,
                        context,
                        buffer.baseAddress,
                        buffer.count
                    )
                }
            }

            guard status == LITECAD_STATUS_OK else {
                let detail = String(cString: errorBuffer)
                throw CADDocumentLoaderError.bridgeFailed(
                    detail.isEmpty ? "LibreDWG 无法读取该 DWG 文件。" : detail
                )
            }
            return try collector.makeScene()
        }.value
    }
}
#endif
