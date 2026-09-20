import Foundation
import CryptoKit
import LiteCADCore

public enum CADInteractionMode: String, CaseIterable, Identifiable, Sendable {
    case pan
    case measure
    case select
    case markup

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .pan: return "移动"
        case .measure: return "测距"
        case .select: return "选择"
        case .markup: return "批注"
        }
    }
}

public enum CADMeasurementTool: String, CaseIterable, Identifiable, Sendable {
    case distance
    case continuousDistance
    case circle
    case area
    case angle
    case coordinate
    case calibration

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .distance: return "距离"
        case .continuousDistance: return "连续距离"
        case .circle: return "圆 / 半径"
        case .area: return "面积"
        case .angle: return "角度"
        case .coordinate: return "坐标"
        case .calibration: return "比例校准"
        }
    }
}

public enum CADTextFontMode: String, CaseIterable, Identifiable, Sendable {
    case system
    case engineering
    case imported

    public var id: String { rawValue }
    public var title: String {
        switch self {
        case .system: return "系统字体"
        case .engineering: return "工程等宽"
        case .imported: return "导入字体"
        }
    }
}

public struct CADMarkup: Equatable, Sendable, Identifiable {
    public let id: UUID
    public let point: CADPoint
    public let text: String

    public init(id: UUID = UUID(), point: CADPoint, text: String) {
        self.id = id
        self.point = point
        self.text = text
    }
}

public extension CADSnapKind {
    var title: String {
        switch self {
        case .endpoint: return "端点"
        case .midpoint: return "中点"
        case .nearest: return "线段"
        }
    }
}

public extension CADMeasurement {
    var formattedDistance: String {
        if distance >= 1 {
            return String(format: "%.3f", distance)
        }
        return String(format: "%.4f", distance)
    }

    var formattedAngle: String { String(format: "%.2f°", angleDegrees) }
}

public enum CADDocumentState: Equatable, Sendable {
    case idle
    case loading(fileName: String)
    case loaded(CADScene)
    case failed(message: String)
}

public enum CADDocumentLoaderError: Error, Equatable, LocalizedError, Sendable {
    case bridgeUnavailable
    case noFileSelected
    case bridgeFailed(String)

    public var errorDescription: String? {
        switch self {
        case .bridgeUnavailable:
            return "原生 LibreDWG bridge 尚未接入。"
        case .noFileSelected:
            return "没有选择图纸文件。"
        case let .bridgeFailed(message):
            return message
        }
    }
}

public protocol CADDocumentLoader: Sendable {
    func load(url: URL) async throws -> CADScene
}

public struct UnavailableCADDocumentLoader: CADDocumentLoader {
    public init() {}

    public func load(url: URL) async throws -> CADScene {
        throw CADDocumentLoaderError.bridgeUnavailable
    }
}

public struct CADDocumentSession: Sendable {
    public private(set) var state: CADDocumentState = .idle

    public init() {}

    public mutating func beginLoading(fileName: String) {
        state = .loading(fileName: fileName)
    }

    public mutating func finishLoading(scene: CADScene) {
        state = .loaded(scene)
    }

    public mutating func fail(message: String) {
        state = .failed(message: message)
    }
}

public struct CADDocumentEditStore: Sendable {
    public init() {}

    public func load(for documentURL: URL) -> [CADEditOperation] {
        guard let journalURL = try? journalURL(for: documentURL),
              let data = try? Data(contentsOf: journalURL),
              let operations = try? JSONDecoder().decode([CADEditOperation].self, from: data) else {
            return []
        }
        return operations
    }

    public func save(_ operations: [CADEditOperation], for documentURL: URL) throws {
        let target = try journalURL(for: documentURL)
        try FileManager.default.createDirectory(
            at: target.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let data = try JSONEncoder().encode(operations)
        try data.write(to: target, options: .atomic)
    }

    private func journalURL(for documentURL: URL) throws -> URL {
        let support = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let digest = SHA256.hash(data: Data(documentURL.standardizedFileURL.path.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
        return support
            .appendingPathComponent("LiteCAD", isDirectory: true)
            .appendingPathComponent("EditJournal", isDirectory: true)
            .appendingPathComponent(digest + ".json")
    }
}

public struct CADDocumentHistoryRecord: Codable, Equatable, Identifiable, Sendable {
    public let id: UUID
    public let fileName: String
    public let sourcePath: String
    public let bookmarkData: Data?
    public let lastOpened: Date

    public init(
        id: UUID = UUID(),
        fileName: String,
        sourcePath: String,
        bookmarkData: Data?,
        lastOpened: Date = Date()
    ) {
        self.id = id
        self.fileName = fileName
        self.sourcePath = sourcePath
        self.bookmarkData = bookmarkData
        self.lastOpened = lastOpened
    }
}

public struct CADDocumentHistoryStore: Sendable {
    private let maximumRecords = 20

    public init() {}

    public func load() -> [CADDocumentHistoryRecord] {
        guard let url = try? storageURL(),
              let data = try? Data(contentsOf: url),
              let records = try? JSONDecoder().decode([CADDocumentHistoryRecord].self, from: data) else {
            return []
        }
        var seen = Set<String>()
        return records
            .sorted { $0.lastOpened > $1.lastOpened }
            .filter { record in
                seen.insert(sourceKey(for: URL(fileURLWithPath: record.sourcePath))).inserted
            }
    }

    @discardableResult
    public func recordOpened(_ documentURL: URL) -> [CADDocumentHistoryRecord] {
        let standardizedURL = documentURL.standardizedFileURL
        let bookmarkData = try? standardizedURL.bookmarkData(
            options: [.minimalBookmark],
            includingResourceValuesForKeys: nil,
            relativeTo: nil
        )
        let record = CADDocumentHistoryRecord(
            fileName: standardizedURL.lastPathComponent,
            sourcePath: standardizedURL.path,
            bookmarkData: bookmarkData
        )
        let key = sourceKey(for: standardizedURL)
        var records = load().filter {
            sourceKey(for: URL(fileURLWithPath: $0.sourcePath)) != key
        }
        records.insert(record, at: 0)
        records = Array(records.prefix(maximumRecords))
        try? save(records)
        return records
    }

    @discardableResult
    public func remove(_ record: CADDocumentHistoryRecord) -> [CADDocumentHistoryRecord] {
        let records = load().filter { $0.id != record.id }
        try? save(records)
        return records
    }

    public func resolve(_ record: CADDocumentHistoryRecord) -> URL? {
        if let bookmarkData = record.bookmarkData {
            var isStale = false
            if let resolved = try? URL(
                resolvingBookmarkData: bookmarkData,
                options: [.withoutUI],
                relativeTo: nil,
                bookmarkDataIsStale: &isStale
            ) {
                return resolved
            }
        }

        let fallback = URL(fileURLWithPath: record.sourcePath)
        return FileManager.default.fileExists(atPath: fallback.path) ? fallback : nil
    }

    private func save(_ records: [CADDocumentHistoryRecord]) throws {
        let url = try storageURL()
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try JSONEncoder().encode(records).write(to: url, options: .atomic)
    }

    private func storageURL() throws -> URL {
        let support = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        return support
            .appendingPathComponent("LiteCAD", isDirectory: true)
            .appendingPathComponent("document-history.json")
    }

    private func sourceKey(for url: URL) -> String {
        let components = url.standardizedFileURL.pathComponents
        guard let applicationIndex = components.firstIndex(of: "Application"),
              components.indices.contains(applicationIndex + 2),
              components[applicationIndex + 1].count >= 20 else {
            return components.joined(separator: "/")
        }

        var normalized = components
        normalized.remove(at: applicationIndex + 1)
        return normalized.joined(separator: "/")
    }
}

public enum CADSceneExportError: Error, LocalizedError, Sendable {
    case emptyScene

    public var errorDescription: String? {
        switch self {
        case .emptyScene:
            return "当前图纸没有可导出的场景内容。"
        }
    }
}

/// Exports the edited compact scene as a portable DXF copy.
///
/// This intentionally does not overwrite the source DWG. The scene graph is
/// the authoritative edited state for the first native editing pass, while
/// LibreDWG's public bridge currently exposes reading only. Block instances
/// are flattened during export so transforms and nested instances remain
/// visually faithful even though the DXF copy does not preserve BLOCK tables.
public enum CADSceneDXFExporter {
    public static func string(for scene: CADScene) throws -> String {
        guard !scene.rootGeometry.isEmpty
            || !scene.rootFills.isEmpty
            || !scene.rootAnnotations.isEmpty
            || !scene.blockInstances.isEmpty else {
            throw CADSceneExportError.emptyScene
        }

        var output = "0\nSECTION\n2\nHEADER\n0\nENDSEC\n"
        let layerNames = Dictionary(uniqueKeysWithValues: scene.layers.map { ($0.id, layerName($0.id, in: scene)) })
        let names = Set(layerNames.values).union(["0"]).sorted()
        output += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n\(names.count)\n"
        for name in names {
            output += "0\nLAYER\n2\n\(name)\n70\n0\n62\n7\n6\nCONTINUOUS\n"
        }
        output += "0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n"

        appendLines(scene.rootGeometry, transform: .identity, layerNames: layerNames, to: &output)
        appendFills(scene.rootFills, transform: .identity, layerNames: layerNames, to: &output)
        appendAnnotations(scene.rootAnnotations, transform: .identity, layerNames: layerNames, to: &output)
        for instance in scene.blockInstances {
            appendDefinition(
                id: instance.definitionID,
                transform: instance.transform,
                depth: 0,
                scene: scene,
                layerNames: layerNames,
                to: &output
            )
        }
        output += "0\nENDSEC\n0\nEOF\n"
        return output
    }

    private static func appendDefinition(
        id: Int,
        transform: CADTransform2D,
        depth: Int,
        scene: CADScene,
        layerNames: [UInt16: String],
        to output: inout String
    ) {
        guard depth < 32, scene.blockDefinitions.indices.contains(id) else { return }
        let definition = scene.blockDefinitions[id]
        appendLines(definition.geometry, transform: transform, layerNames: layerNames, to: &output)
        appendFills(definition.fills, transform: transform, layerNames: layerNames, to: &output)
        appendAnnotations(definition.annotations, transform: transform, layerNames: layerNames, to: &output)
        for nested in definition.nestedInstances {
            appendDefinition(
                id: nested.definitionID,
                transform: transform.concatenating(nested.transform),
                depth: depth + 1,
                scene: scene,
                layerNames: layerNames,
                to: &output
            )
        }
    }

    private static func appendLines(
        _ geometry: CADLineBuffer,
        transform: CADTransform2D,
        layerNames: [UInt16: String],
        to output: inout String
    ) {
        for index in 0..<geometry.lineCount {
            guard let line = geometry.segment(at: index) else { continue }
            let start = transform.applying(to: line.start)
            let end = transform.applying(to: line.end)
            output += "0\nLINE\n8\n\(layerNames[line.layerID] ?? "0")\n10\n\(number(start.x))\n20\n\(number(start.y))\n30\n0.0\n11\n\(number(end.x))\n21\n\(number(end.y))\n31\n0.0\n"
        }
    }

    private static func appendFills(
        _ fills: [CADFillPolygon],
        transform: CADTransform2D,
        layerNames: [UInt16: String],
        to output: inout String
    ) {
        for fill in fills where fill.points.count >= 3 {
            let points = fill.points.map { transform.applying(to: $0) }
            output += "0\nLWPOLYLINE\n8\n\(layerNames[fill.layerID] ?? "0")\n90\n\(points.count)\n70\n1\n"
            for point in points {
                output += "10\n\(number(point.x))\n20\n\(number(point.y))\n"
            }
        }
    }

    private static func appendAnnotations(
        _ annotations: [CADTextAnnotation],
        transform: CADTransform2D,
        layerNames: [UInt16: String],
        to output: inout String
    ) {
        for annotation in annotations {
            let value = annotation.transformed(by: transform)
            let text = value.text
                .replacingOccurrences(of: "\0", with: "")
                .replacingOccurrences(of: "\n", with: "\\P")
            let rotation = value.rotation * 180 / .pi
            if value.kind == .mtext {
                output += "0\nMTEXT\n8\n\(layerNames[value.layerID] ?? "0")\n10\n\(number(value.position.x))\n20\n\(number(value.position.y))\n30\n0.0\n40\n\(number(value.height))\n1\n\(text)\n"
            } else {
                output += "0\nTEXT\n8\n\(layerNames[value.layerID] ?? "0")\n10\n\(number(value.position.x))\n20\n\(number(value.position.y))\n30\n0.0\n40\n\(number(value.height))\n1\n\(text)\n50\n\(number(rotation))\n"
            }
        }
    }

    private static func layerName(_ id: UInt16, in scene: CADScene) -> String {
        scene.layers.first(where: { $0.id == id })?.name ?? "Layer \(id)"
    }

    private static func number(_ value: Float) -> String {
        String(format: "%.6f", locale: Locale(identifier: "en_US_POSIX"), Double(value))
    }
}
