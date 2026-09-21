#if os(iOS)
import Foundation
import RoomPlan
import SceneKit
import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct RoomScanRecord: Codable, Identifiable, Equatable {
    let id: UUID
    let createdAt: Date
    let displayName: String
    let usdFileName: String
    let jsonFileName: String
    let surfaceCount: Int
    let objectCount: Int
}

@MainActor
final class RoomScanStore: ObservableObject {
    @Published private(set) var records: [RoomScanRecord] = []

    private let fileManager = FileManager.default
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        self.encoder = encoder
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder
        records = loadRecords()
    }

    func save(room: CapturedRoom, displayName: String) throws -> (RoomScanRecord, [URL]) {
        let id = UUID()
        let requestedName = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        let safeName = requestedName.isEmpty
            ? "现场扫描-\(Self.fileDateFormatter.string(from: Date()))"
            : requestedName
                .replacingOccurrences(of: "/", with: "-", options: .literal)
                .replacingOccurrences(of: ":", with: "-", options: .literal)
        let folder = try scansDirectory().appendingPathComponent(id.uuidString, isDirectory: true)
        try fileManager.createDirectory(at: folder, withIntermediateDirectories: true)

        let usdURL = folder.appendingPathComponent("\(safeName).usdz")
        let jsonURL = folder.appendingPathComponent("\(safeName).roomplan.json")
        try room.export(to: usdURL, exportOptions: .mesh)
        try encoder.encode(room).write(to: jsonURL, options: .atomic)

        let record = RoomScanRecord(
            id: id,
            createdAt: Date(),
            displayName: safeName,
            usdFileName: usdURL.lastPathComponent,
            jsonFileName: jsonURL.lastPathComponent,
            surfaceCount: room.walls.count + room.doors.count + room.windows.count + room.openings.count + room.floors.count,
            objectCount: room.objects.count
        )
        records.insert(record, at: 0)
        records = Array(records.prefix(20))
        try encoder.encode(records).write(to: recordsURL(), options: .atomic)
        return (record, [usdURL, jsonURL])
    }

    func urls(for record: RoomScanRecord) -> [URL] {
        let folder = (try? scansDirectory().appendingPathComponent(record.id.uuidString, isDirectory: true))
        guard let folder else { return [] }
        return [
            folder.appendingPathComponent(record.usdFileName),
            folder.appendingPathComponent(record.jsonFileName)
        ].filter { fileManager.fileExists(atPath: $0.path) }
    }

    func delete(_ record: RoomScanRecord) {
        guard let folder = try? scansDirectory().appendingPathComponent(record.id.uuidString, isDirectory: true) else { return }
        try? fileManager.removeItem(at: folder)
        records.removeAll { $0.id == record.id }
        try? encoder.encode(records).write(to: recordsURL(), options: .atomic)
    }

    func importFile(from sourceURL: URL) throws -> URL {
        let securityScoped = sourceURL.startAccessingSecurityScopedResource()
        defer {
            if securityScoped { sourceURL.stopAccessingSecurityScopedResource() }
        }
        let folder = try scansDirectory().appendingPathComponent("Imported-\(UUID().uuidString)", isDirectory: true)
        try fileManager.createDirectory(at: folder, withIntermediateDirectories: true)
        let fileName = sourceURL.lastPathComponent.isEmpty ? "imported-scan.usdz" : sourceURL.lastPathComponent
        let destination = folder.appendingPathComponent(fileName)
        try fileManager.copyItem(at: sourceURL, to: destination)
        return destination
    }

    private func loadRecords() -> [RoomScanRecord] {
        guard let data = try? Data(contentsOf: recordsURL()),
              let values = try? decoder.decode([RoomScanRecord].self, from: data) else { return [] }
        return values.filter { !urls(for: $0).isEmpty }
    }

    private func recordsURL() -> URL {
        (try? scansDirectory().appendingPathComponent("index.json"))
            ?? fileManager.temporaryDirectory.appendingPathComponent("litecad-room-scans.json")
    }

    private func scansDirectory() throws -> URL {
        let base = try fileManager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let directory = base.appendingPathComponent("LiteCAD/RoomScans", isDirectory: true)
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private static let fileDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyyMMdd-HHmmss"
        return formatter
    }()
}

@MainActor
final class RoomScanSessionModel: NSObject, ObservableObject {
    enum Phase: Equatable {
        case ready
        case scanning
        case processing
        case completed
        case failed(String)
    }

    @Published private(set) var phase: Phase = .ready
    @Published private(set) var room: CapturedRoom?
    @Published private(set) var instruction = "缓慢移动手机，依次扫过墙面、地面和家具。"

    weak var captureView: RoomCaptureView?

    var isSupported: Bool { RoomCaptureSession.isSupported }

    func attach(_ captureView: RoomCaptureView) {
        self.captureView = captureView
        guard isSupported else {
            phase = .failed("此设备没有 LiDAR，无法启动 RoomPlan 扫描。")
            return
        }
        var configuration = RoomCaptureSession.Configuration()
        configuration.isCoachingEnabled = true
        captureView.captureSession.run(configuration: configuration)
        phase = .scanning
    }

    func stop() {
        guard phase == .scanning else { return }
        phase = .processing
        captureView?.captureSession.stop()
    }

    func reset() {
        room = nil
        phase = .ready
        instruction = "缓慢移动手机，依次扫过墙面、地面和家具。"
    }

    func prepareProcessing(error: Error?) {
        if let error {
            phase = .failed(error.localizedDescription)
            return
        }
        phase = .processing
    }

    func finishProcessing(room: CapturedRoom, error: Error?) {
        if let error {
            phase = .failed(error.localizedDescription)
            return
        }
        self.room = room
        phase = .completed
    }

    func update(instruction: RoomCaptureSession.Instruction) {
        switch instruction {
        case .moveCloseToWall: self.instruction = "请靠近墙面扫描。"
        case .moveAwayFromWall: self.instruction = "请稍微远离墙面。"
        case .slowDown: self.instruction = "请放慢移动速度。"
        case .turnOnLight: self.instruction = "环境较暗，请打开现场照明。"
        case .lowTexture: self.instruction = "表面纹理不足，请换一个角度。"
        case .normal: self.instruction = "继续缓慢移动，覆盖未扫描区域。"
        @unknown default: self.instruction = "继续缓慢移动，覆盖未扫描区域。"
        }
    }
}

private struct RoomCaptureRepresentable: UIViewRepresentable {
    @ObservedObject var model: RoomScanSessionModel

    func makeCoordinator() -> RoomCaptureCoordinator {
        RoomCaptureCoordinator(model: model)
    }

    func makeUIView(context: Context) -> RoomCaptureView {
        let view = RoomCaptureView(frame: .zero)
        view.delegate = context.coordinator
        context.coordinator.view = view
        view.captureSession.delegate = context.coordinator
        model.attach(view)
        return view
    }

    func updateUIView(_ uiView: RoomCaptureView, context: Context) {}

}

final class RoomCaptureCoordinator: NSObject, RoomCaptureViewDelegate, RoomCaptureSessionDelegate {
    let model: RoomScanSessionModel
    weak var view: RoomCaptureView?

    init(model: RoomScanSessionModel) {
        self.model = model
    }

    func encode(with coder: NSCoder) {}

    required init?(coder: NSCoder) {
        return nil
    }

    func captureView(
        shouldPresent roomDataForProcessing: CapturedRoomData,
        error: Error?
    ) -> Bool {
        Task { @MainActor [weak model] in
            model?.prepareProcessing(error: error)
        }
        return error == nil
    }

    func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
        Task { @MainActor [weak model] in
            model?.finishProcessing(room: processedResult, error: error)
        }
    }

    func captureSession(
        _ session: RoomCaptureSession,
        didProvide instruction: RoomCaptureSession.Instruction
    ) {
        Task { @MainActor [weak model] in
            model?.update(instruction: instruction)
        }
    }
}

struct HomeDesignScanView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var session = RoomScanSessionModel()
    @StateObject private var store = RoomScanStore()
    @State private var scanName = ""
    @State private var shareItems: [Any] = []
    @State private var pendingShareItems: [Any]?
    @State private var isSharePresented = false
    @State private var isFilesPresented = false
    @State private var isImporterPresented = false
    @State private var isPreviewPresented = false
    @State private var previewURL: URL?
    @State private var statusMessage = ""
    @State private var isStatusPresented = false

    var body: some View {
        NavigationStack {
            Group {
                if !session.isSupported {
                    unsupportedView
                } else {
                    scannerView
                }
            }
            .navigationTitle("家装设计 3D 扫描")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("关闭") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        isFilesPresented = true
                    } label: {
                        Image(systemName: "folder")
                    }
                    .accessibilityLabel("已保存扫描文件")
                }
            }
        }
        .sheet(isPresented: $isSharePresented) {
            RoomScanShareSheet(items: shareItems)
        }
        .sheet(isPresented: $isFilesPresented, onDismiss: presentPendingShare) {
            RoomScanFilesView(
                store: store,
                onOpen: open(record:),
                onShare: share(record:),
                onImport: { isImporterPresented = true }
            )
        }
        .sheet(isPresented: $isPreviewPresented) {
            if let previewURL {
                ThreeDScanPreviewView(url: previewURL)
            }
        }
        .fileImporter(
            isPresented: $isImporterPresented,
            allowedContentTypes: [UTType(filenameExtension: "usdz") ?? .data],
            allowsMultipleSelection: false,
            onCompletion: importFileResult
        )
        .alert("家装设计 3D 扫描", isPresented: $isStatusPresented) {
            Button("知道了", role: .cancel) {}
        } message: {
            Text(statusMessage)
        }
    }

    private var scannerView: some View {
        ZStack(alignment: .bottom) {
            RoomCaptureRepresentable(model: session)
                .ignoresSafeArea()

            VStack(spacing: 10) {
                statusPanel
                if case .scanning = session.phase {
                    Button {
                        session.stop()
                    } label: {
                        Label("完成扫描", systemImage: "checkmark.circle.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.cyan)
                } else if case .processing = session.phase {
                    ProgressView("正在整理房间和家具…")
                        .padding(.vertical, 10)
                } else if case .completed = session.phase, let room = session.room {
                    completedPanel(room: room)
                } else if case .failed = session.phase {
                    Button("重新开始") { session.reset() }
                        .buttonStyle(.borderedProminent)
                }
            }
            .padding(12)
        }
        .background(Color.black)
    }

    private var unsupportedView: some View {
        ContentUnavailableView(
            "需要 LiDAR 设备",
            systemImage: "camera.metering.center.weighted",
            description: Text("空间扫描需要支持 LiDAR 的 iPhone。普通设备仍可使用 DWG 查看和 CAD 测量。")
        )
        .padding(24)
    }

    private var statusPanel: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                    Label("家装设计 3D 扫描", systemImage: "house.lodge")
                    .font(.headline)
                Spacer()
                phaseLabel
            }
            Text(session.instruction)
                .font(.footnote)
                .foregroundStyle(.secondary)
            if case let .failed(message) = session.phase {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
        }
        .padding(12)
        .background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 14))
    }

    private var phaseLabel: some View {
        switch session.phase {
        case .ready: return Text("准备中").foregroundStyle(.secondary)
        case .scanning: return Text("扫描中").foregroundStyle(.green)
        case .processing: return Text("处理中").foregroundStyle(.yellow)
        case .completed: return Text("已完成").foregroundStyle(.cyan)
        case .failed: return Text("不可用").foregroundStyle(.orange)
        }
    }

    private func completedPanel(room: CapturedRoom) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("墙面 \(room.walls.count) · 地面 \(room.floors.count) · 家具 \(room.objects.count)")
                .font(.subheadline.weight(.semibold))
            Text(objectSummary(room))
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
            TextField("名称，例如：一楼机房", text: $scanName)
                .textFieldStyle(.roundedBorder)
            HStack(spacing: 8) {
                Button {
                    save(room: room)
                } label: {
                    Label("保存 3D", systemImage: "externaldrive.badge.plus")
                }
                .buttonStyle(.borderedProminent)
                if previewURL != nil {
                    Button {
                        isPreviewPresented = true
                    } label: {
                        Label("查看3D", systemImage: "rotate.3d")
                    }
                    .buttonStyle(.bordered)
                }
                Button("重新扫描") { session.reset() }
                    .buttonStyle(.bordered)
            }
        }
        .padding(12)
        .background(.black.opacity(0.86), in: RoundedRectangle(cornerRadius: 14))
    }

    private func save(room: CapturedRoom) {
        do {
            let (_, urls) = try store.save(room: room, displayName: scanName)
            previewURL = urls.first
            shareItems = urls
            isSharePresented = true
        } catch {
            statusMessage = "保存失败：\(error.localizedDescription)"
            isStatusPresented = true
        }
    }

    private func open(record: RoomScanRecord) {
        guard let url = store.urls(for: record).first else {
            statusMessage = "扫描文件已不存在，请重新导入或重新扫描。"
            isStatusPresented = true
            return
        }
        previewURL = url
        isFilesPresented = false
        isPreviewPresented = true
    }

    private func share(record: RoomScanRecord) {
        let urls = store.urls(for: record)
        guard !urls.isEmpty else {
            statusMessage = "扫描文件已不存在，无法分享。"
            isStatusPresented = true
            return
        }
        pendingShareItems = urls
        isFilesPresented = false
    }

    private func presentPendingShare() {
        guard let pendingShareItems else { return }
        self.pendingShareItems = nil
        shareItems = pendingShareItems
        DispatchQueue.main.async {
            isSharePresented = true
        }
    }

    private func importFileResult(_ result: Result<[URL], Error>) {
        do {
            guard let sourceURL = try result.get().first else { return }
            let importedURL = try store.importFile(from: sourceURL)
            previewURL = importedURL
            isPreviewPresented = true
        } catch {
            statusMessage = "导入失败：\(error.localizedDescription)"
            isStatusPresented = true
        }
    }

    private func objectSummary(_ room: CapturedRoom) -> String {
        let names = room.objects.map { object in
            switch object.category {
            case .storage: return "储物"
            case .refrigerator: return "冰箱"
            case .stove: return "炉具"
            case .bed: return "床"
            case .sink: return "水槽"
            case .washerDryer: return "洗衣机"
            case .toilet: return "卫浴"
            case .bathtub: return "浴缸"
            case .oven: return "烤箱"
            case .dishwasher: return "洗碗机"
            case .table: return "桌子"
            case .sofa: return "沙发"
            case .chair: return "椅子"
            case .fireplace: return "壁炉"
            case .television: return "电视"
            case .stairs: return "楼梯"
            @unknown default: return "其他"
            }
        }
        return names.isEmpty ? "未识别到标准家具类别；仍可保存可见空间模型。" : names.joined(separator: "、")
    }
}

private struct RoomScanFilesView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: RoomScanStore
    let onOpen: (RoomScanRecord) -> Void
    let onShare: (RoomScanRecord) -> Void
    let onImport: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button {
                        onImport()
                        dismiss()
                    } label: {
                        Label("从 Files 导入 USDZ 扫描文件", systemImage: "folder.badge.plus")
                    }
                }
                Section("本机已保存") {
                    if store.records.isEmpty {
                        ContentUnavailableView(
                            "暂无扫描文件",
                            systemImage: "cube.transparent",
                            description: Text("完成扫描并保存后，文件会出现在这里。")
                        )
                    } else {
                        ForEach(store.records) { record in
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Image(systemName: "cube.transparent")
                                        .foregroundStyle(.cyan)
                                    Text(record.displayName)
                                        .font(.subheadline.weight(.semibold))
                                        .lineLimit(1)
                                    Spacer()
                                }
                                Text("墙面/表面 \(record.surfaceCount) · 家具 \(record.objectCount) · \(record.createdAt.formatted(date: .abbreviated, time: .shortened))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                HStack {
                                    Button("打开3D") { onOpen(record) }
                                        .buttonStyle(.borderedProminent)
                                        .controlSize(.small)
                                    Button("分享 / 云端") { onShare(record) }
                                        .buttonStyle(.bordered)
                                        .controlSize(.small)
                                    Button(role: .destructive) { store.delete(record) } label: {
                                        Image(systemName: "trash")
                                    }
                                    .buttonStyle(.bordered)
                                    .controlSize(.small)
                                    .accessibilityLabel("删除 \(record.displayName)")
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
            .navigationTitle("扫描文件")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { dismiss() }
                }
            }
        }
    }
}

struct ThreeDScanPreviewView: View {
    @Environment(\.dismiss) private var dismiss
    let url: URL

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                RoomScanSceneView(url: url)
                    .ignoresSafeArea()
                Text("单指旋转 · 双指平移 · 捏合缩放")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background(.black.opacity(0.72), in: Capsule())
                    .padding(.bottom, 18)
            }
            .navigationTitle(url.deletingPathExtension().lastPathComponent)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { dismiss() }
                }
            }
        }
    }
}

struct RoomScanSceneView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> SCNView {
        let view = SCNView(frame: .zero)
        view.backgroundColor = UIColor(white: 0.06, alpha: 1)
        // Do not enable SceneKit's debug wireframe here. Photogrammetry USDZ
        // files contain a dense triangle mesh; showing every triangle turns a
        // valid model into a cloud of white dots and makes the saved scan look
        // empty. The lit textured surface preserves the object's outer
        // silhouette without exposing internal mesh topology.
        view.debugOptions = []
        view.autoenablesDefaultLighting = false
        view.antialiasingMode = .multisampling4X
        view.allowsCameraControl = true
        view.cameraControlConfiguration.allowsTranslation = true
        view.defaultCameraController.inertiaEnabled = true
        view.defaultCameraController.automaticTarget = true
        do {
            let scene = try SCNScene(url: url, options: [.checkConsistency: true])
            scene.background.contents = UIColor(white: 0.06, alpha: 1)
            if isObjectScan(url) {
                applyObjectScanMaterials(to: scene.rootNode)
            } else {
                applyFallbackMaterials(to: scene.rootNode)
            }
            guard let bounds = visibleBounds(for: scene.rootNode) else {
                throw PreviewError.noVisibleGeometry
            }
            let minBounds = bounds.min
            let maxBounds = bounds.max
            let center = SCNVector3(
                (minBounds.x + maxBounds.x) / 2,
                (minBounds.y + maxBounds.y) / 2,
                (minBounds.z + maxBounds.z) / 2
            )
            let size = SCNVector3(
                maxBounds.x - minBounds.x,
                maxBounds.y - minBounds.y,
                maxBounds.z - minBounds.z
            )
            let largestDimension = max(size.x, max(size.y, size.z))
            // RoomPlan scenes are measured in meters, while Object Capture
            // models can be much smaller. A fixed minimum distance made saved
            // bottles and furniture appear as tiny dots, so frame from the
            // actual model size and only keep a small numerical floor.
            let cameraDistance = max(largestDimension * 1.85, 0.18)

            let ambientLight = SCNNode()
            ambientLight.light = SCNLight()
            ambientLight.light?.type = .ambient
            ambientLight.light?.color = UIColor(white: 0.78, alpha: 1)
            ambientLight.light?.intensity = isObjectScan(url) ? 105 : 130
            scene.rootNode.addChildNode(ambientLight)

            let keyLight = SCNNode()
            keyLight.light = SCNLight()
            keyLight.light?.type = .omni
            keyLight.light?.color = UIColor(white: 1, alpha: 1)
            keyLight.light?.intensity = isObjectScan(url) ? 300 : 420
            keyLight.light?.attenuationEndDistance = CGFloat(max(cameraDistance * 4, 20))
            keyLight.position = SCNVector3(
                center.x + cameraDistance,
                center.y + cameraDistance,
                center.z + cameraDistance
            )
            scene.rootNode.addChildNode(keyLight)

            let cameraNode = SCNNode()
            cameraNode.camera = SCNCamera()
            cameraNode.camera?.zNear = 0.01
            cameraNode.camera?.zFar = Double(max(cameraDistance * 20, 100))
            cameraNode.camera?.fieldOfView = 50
            cameraNode.position = SCNVector3(
                center.x,
                center.y + cameraDistance * 0.28,
                center.z + cameraDistance
            )
            cameraNode.look(at: center)
            scene.rootNode.addChildNode(cameraNode)
            view.scene = scene
            view.pointOfView = cameraNode
            view.defaultCameraController.pointOfView = cameraNode
            view.defaultCameraController.target = center
        } catch {
            let label = UILabel(frame: .zero)
            label.text = "3D 文件无法加载\n\(error.localizedDescription)"
            label.textColor = .white
            label.textAlignment = .center
            label.numberOfLines = 0
            label.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(label)
            NSLayoutConstraint.activate([
                label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
                label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
                label.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
            label.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -24)
            ])
        }
        return view
    }

    func updateUIView(_ uiView: SCNView, context: Context) {}

    private enum PreviewError: LocalizedError {
        case noVisibleGeometry

        var errorDescription: String? {
            "USDZ 文件中没有可显示的几何体"
        }
    }

    private func applyFallbackMaterials(to node: SCNNode) {
        if let geometry = node.geometry {
            if geometry.materials.isEmpty {
                let material = SCNMaterial()
                material.diffuse.contents = UIColor(white: 0.82, alpha: 1)
                material.lightingModel = .physicallyBased
                material.roughness.contents = 0.82
                geometry.firstMaterial = material
            } else {
                for material in geometry.materials where material.diffuse.contents == nil {
                    material.diffuse.contents = UIColor(white: 0.82, alpha: 1)
                    material.lightingModel = .physicallyBased
                    material.roughness.contents = 0.82
                }
            }
        }
        node.childNodes.forEach(applyFallbackMaterials)
    }

    private func applyObjectScanMaterials(to node: SCNNode) {
        if let geometry = node.geometry {
            if geometry.materials.isEmpty {
                let material = SCNMaterial()
                material.diffuse.contents = UIColor(white: 0.62, alpha: 1)
                material.lightingModel = .lambert
                geometry.firstMaterial = material
            } else {
                // Keep the baked Object Capture texture. Only normalize the
                // lighting model so the scan retains its real appearance
                // without SceneKit's dense debug wireframe.
                for material in geometry.materials {
                    material.lightingModel = .lambert
                    material.metalness.contents = 0
                    material.roughness.contents = 0.88
                    if material.diffuse.contents == nil {
                        material.diffuse.contents = UIColor(white: 0.62, alpha: 1)
                    }
                }
            }
        }
        node.childNodes.forEach(applyObjectScanMaterials)
    }

    private func isObjectScan(_ url: URL) -> Bool {
        url.path.contains("/ObjectScans/") || url.path.contains("/ObjectScanWork/")
    }

    private func visibleBounds(for rootNode: SCNNode) -> (min: SCNVector3, max: SCNVector3)? {
        var minBounds = SCNVector3(Float.greatestFiniteMagnitude,
                                   Float.greatestFiniteMagnitude,
                                   Float.greatestFiniteMagnitude)
        var maxBounds = SCNVector3(-Float.greatestFiniteMagnitude,
                                   -Float.greatestFiniteMagnitude,
                                   -Float.greatestFiniteMagnitude)
        var foundGeometry = false

        func include(_ point: SCNVector3) {
            guard point.x.isFinite, point.y.isFinite, point.z.isFinite else { return }
            minBounds.x = min(minBounds.x, point.x)
            minBounds.y = min(minBounds.y, point.y)
            minBounds.z = min(minBounds.z, point.z)
            maxBounds.x = max(maxBounds.x, point.x)
            maxBounds.y = max(maxBounds.y, point.y)
            maxBounds.z = max(maxBounds.z, point.z)
            foundGeometry = true
        }

        func visit(_ node: SCNNode) {
            if let geometry = node.geometry {
                let bounds = geometry.boundingBox
                let minPoint = bounds.min
                let maxPoint = bounds.max
                if minPoint.x.isFinite, minPoint.y.isFinite, minPoint.z.isFinite,
                   maxPoint.x.isFinite, maxPoint.y.isFinite, maxPoint.z.isFinite,
                   minPoint.x <= maxPoint.x, minPoint.y <= maxPoint.y, minPoint.z <= maxPoint.z {
                    let points = [
                        SCNVector3(minPoint.x, minPoint.y, minPoint.z),
                        SCNVector3(minPoint.x, minPoint.y, maxPoint.z),
                        SCNVector3(minPoint.x, maxPoint.y, minPoint.z),
                        SCNVector3(minPoint.x, maxPoint.y, maxPoint.z),
                        SCNVector3(maxPoint.x, minPoint.y, minPoint.z),
                        SCNVector3(maxPoint.x, minPoint.y, maxPoint.z),
                        SCNVector3(maxPoint.x, maxPoint.y, minPoint.z),
                        SCNVector3(maxPoint.x, maxPoint.y, maxPoint.z)
                    ]
                    points.forEach { include(node.convertPosition($0, to: rootNode)) }
                }
            }
            node.childNodes.forEach(visit)
        }

        visit(rootNode)
        guard foundGeometry else { return nil }
        let size = SCNVector3(maxBounds.x - minBounds.x,
                              maxBounds.y - minBounds.y,
                              maxBounds.z - minBounds.z)
        guard size.x > 0 || size.y > 0 || size.z > 0 else { return nil }
        return (minBounds, maxBounds)
    }
}

private struct RoomScanShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
#endif
