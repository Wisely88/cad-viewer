#if os(iOS)
import Foundation
import RealityKit
import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct ThreeDScanHubView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    NavigationLink {
                        HomeDesignScanView()
                    } label: {
                        ThreeDScanModuleRow(
                            title: "家装设计 3D 扫描",
                            subtitle: "扫描房间、墙面、门窗和家具，用于现场设计核对。",
                            systemImage: "house.lodge",
                            tint: .cyan
                        )
                    }

                    NavigationLink {
                        ObjectScanView()
                    } label: {
                        ThreeDScanModuleRow(
                            title: "静物3D扫描",
                            subtitle: "围绕家具、设备、摆件或器件拍摄，生成可保存的 3D 模型。",
                            systemImage: "cube.transparent",
                            tint: .orange
                        )
                    }
                } header: {
                    Text("选择扫描模块")
                } footer: {
                    Text("两个模块独立保存和管理扫描文件，均支持 3D 预览中的旋转、平移和缩放。")
                }
            }
            .navigationTitle("3D 扫描")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { dismiss() }
                }
            }
        }
    }
}

private struct ThreeDScanModuleRow: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let tint: Color

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: systemImage)
                .font(.title2)
                .foregroundStyle(tint)
                .frame(width: 38, height: 38)
                .background(tint.opacity(0.14), in: RoundedRectangle(cornerRadius: 10))
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                Text(subtitle)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 6)
    }
}

struct ObjectScanRecord: Codable, Identifiable, Equatable {
    let id: UUID
    let createdAt: Date
    let displayName: String
    let usdFileName: String
    let shotCount: Int
}

@MainActor
final class ObjectScanStore: ObservableObject {
    @Published private(set) var records: [ObjectScanRecord] = []

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

    func save(modelURL: URL, displayName: String, shotCount: Int) throws -> (ObjectScanRecord, URL) {
        let id = UUID()
        let safeName = makeSafeName(displayName)
        let folder = try scansDirectory().appendingPathComponent(id.uuidString, isDirectory: true)
        try fileManager.createDirectory(at: folder, withIntermediateDirectories: true)
        let destination = folder.appendingPathComponent("\(safeName).usdz")
        try fileManager.copyItem(at: modelURL, to: destination)

        let record = ObjectScanRecord(
            id: id,
            createdAt: Date(),
            displayName: safeName,
            usdFileName: destination.lastPathComponent,
            shotCount: shotCount
        )
        records.insert(record, at: 0)
        records = Array(records.prefix(20))
        try encoder.encode(records).write(to: recordsURL(), options: .atomic)
        return (record, destination)
    }

    func importUSDZ(from sourceURL: URL) throws -> (ObjectScanRecord, URL) {
        let securityScoped = sourceURL.startAccessingSecurityScopedResource()
        defer {
            if securityScoped { sourceURL.stopAccessingSecurityScopedResource() }
        }
        let id = UUID()
        let folder = try scansDirectory().appendingPathComponent(id.uuidString, isDirectory: true)
        try fileManager.createDirectory(at: folder, withIntermediateDirectories: true)
        let baseName = sourceURL.deletingPathExtension().lastPathComponent
        let safeName = makeSafeName(baseName.isEmpty ? "导入静物3D模型" : baseName)
        let destination = folder.appendingPathComponent("\(safeName).usdz")
        try fileManager.copyItem(at: sourceURL, to: destination)
        let record = ObjectScanRecord(
            id: id,
            createdAt: Date(),
            displayName: safeName,
            usdFileName: destination.lastPathComponent,
            shotCount: 0
        )
        records.insert(record, at: 0)
        records = Array(records.prefix(20))
        try encoder.encode(records).write(to: recordsURL(), options: .atomic)
        return (record, destination)
    }

    func url(for record: ObjectScanRecord) -> URL? {
        guard let folder = try? scansDirectory().appendingPathComponent(record.id.uuidString, isDirectory: true) else {
            return nil
        }
        let url = folder.appendingPathComponent(record.usdFileName)
        return fileManager.fileExists(atPath: url.path) ? url : nil
    }

    func delete(_ record: ObjectScanRecord) {
        guard let folder = try? scansDirectory().appendingPathComponent(record.id.uuidString, isDirectory: true) else { return }
        try? fileManager.removeItem(at: folder)
        records.removeAll { $0.id == record.id }
        try? encoder.encode(records).write(to: recordsURL(), options: .atomic)
    }

    private func loadRecords() -> [ObjectScanRecord] {
        guard let data = try? Data(contentsOf: recordsURL()),
              let values = try? decoder.decode([ObjectScanRecord].self, from: data) else { return [] }
        return values.filter { url(for: $0) != nil }
    }

    private func recordsURL() -> URL {
        (try? scansDirectory().appendingPathComponent("index.json"))
            ?? fileManager.temporaryDirectory.appendingPathComponent("litecad-object-scans.json")
    }

    private func scansDirectory() throws -> URL {
        let base = try fileManager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let directory = base.appendingPathComponent("LiteCAD/ObjectScans", isDirectory: true)
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private func makeSafeName(_ name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let safe = trimmed
            .replacingOccurrences(of: "/", with: "-", options: .literal)
            .replacingOccurrences(of: ":", with: "-", options: .literal)
        return safe.isEmpty ? "静物3D扫描-\(Self.dateFormatter.string(from: Date()))" : safe
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyyMMdd-HHmmss"
        return formatter
    }()
}

@MainActor
final class ObjectScanModel: ObservableObject {
    enum Phase: Equatable {
        case idle
        case detecting
        case capturing
        case processing
        case completed
        case failed(String)
    }

    @Published private(set) var session = ObjectCaptureSession()
    @Published private(set) var phase: Phase = .idle
    @Published private(set) var message = "把物品放在光线均匀、背景干净的位置。"
    @Published private(set) var progress = 0.0
    @Published private(set) var shotCount = 0
    @Published private(set) var hasCompletedScanPass = false
    @Published private(set) var modelURL: URL?

    private var imagesDirectory: URL?
    private var processingTask: Task<Void, Never>?
    private var photogrammetrySession: PhotogrammetrySession?

    var isSupported: Bool { ObjectCaptureSession.isSupported }

    var maximumShotCount: Int {
        session.maximumNumberOfInputImages
    }

    var captureProgress: Double {
        guard maximumShotCount > 0 else { return hasCompletedScanPass ? 1 : 0 }
        return min(Double(shotCount) / Double(maximumShotCount), 1)
    }

    func start() {
        guard isSupported else {
            phase = .failed("此设备不支持静物3D扫描。")
            return
        }
        do {
            let base = try FileManager.default.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )
            let directory = base
                .appendingPathComponent("LiteCAD/ObjectScanWork/\(UUID().uuidString)", isDirectory: true)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            imagesDirectory = directory
            modelURL = nil
            shotCount = 0
            hasCompletedScanPass = false
            progress = 0
            var configuration = ObjectCaptureSession.Configuration()
            configuration.isOverCaptureEnabled = true
            session.start(imagesDirectory: directory, configuration: configuration)
            _ = session.startDetecting()
            phase = .detecting
            message = "请缓慢绕物品移动，保持物品完整出现在取景框内。"
        } catch {
            phase = .failed("无法创建扫描缓存：\(error.localizedDescription)")
        }
    }

    func startCapturing() {
        session.startCapturing()
        phase = .capturing
        message = "继续绕物品移动，尽量覆盖顶部、侧面和底部边缘。"
    }

    func finish() {
        guard phase == .capturing else { return }
        phase = .processing
        message = "正在整理拍摄素材，完成后生成 3D 模型。"
        session.finish()
    }

    func reset() {
        processingTask?.cancel()
        processingTask = nil
        photogrammetrySession?.cancel()
        photogrammetrySession = nil
        session.cancel()
        session = ObjectCaptureSession()
        phase = .idle
        message = "把物品放在光线均匀、背景干净的位置。"
        progress = 0
        shotCount = 0
        hasCompletedScanPass = false
        modelURL = nil
    }

    func observeState() async {
        for await state in session.stateUpdates {
            update(state: state)
        }
    }

    func observeShotCount() async {
        for await count in session.numberOfShotsTakenUpdates {
            shotCount = count
        }
    }

    func observeScanPass() async {
        for await completed in session.userCompletedScanPassUpdates {
            hasCompletedScanPass = completed
        }
    }

    private func update(state: ObjectCaptureSession.CaptureState) {
        switch state {
        case .initializing:
            message = "正在启动相机和物体追踪…"
        case .ready:
            if phase == .idle { message = "准备完成，请开始识别物品。" }
        case .detecting:
            phase = .detecting
        case .capturing:
            phase = .capturing
        case .finishing:
            phase = .processing
        case .completed:
            beginPhotogrammetryIfNeeded()
        case .failed(let error):
            phase = .failed(error.localizedDescription)
        @unknown default:
            message = "扫描状态发生变化，请继续按提示操作。"
        }
    }

    private func beginPhotogrammetryIfNeeded() {
        guard processingTask == nil, let imagesDirectory else { return }
        phase = .processing
        modelURL = nil
        progress = 0
        processingTask = Task { [weak self] in
            do {
                var configuration = PhotogrammetrySession.Configuration()
                configuration.isObjectMaskingEnabled = true
                let photogrammetry = try PhotogrammetrySession(input: imagesDirectory, configuration: configuration)
                let outputURL = imagesDirectory
                    .deletingLastPathComponent()
                    .appendingPathComponent("model-\(UUID().uuidString).usdz")
                self?.photogrammetrySession = photogrammetry
                try photogrammetry.process(requests: [.modelFile(url: outputURL, detail: .reduced)])
                for try await output in photogrammetry.outputs {
                    switch output {
                    case .requestProgress(_, let fractionComplete):
                        self?.progress = fractionComplete
                    case .requestComplete(_, .modelFile(let url)):
                        guard FileManager.default.fileExists(atPath: url.path),
                              (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? NSNumber)?.int64Value ?? 0 > 0 else {
                            self?.phase = .failed("3D 模型输出为空，请增加拍摄角度后重试。")
                            continue
                        }
                        self?.modelURL = url
                    case .processingComplete:
                        guard let self,
                              let modelURL = self.modelURL,
                              FileManager.default.fileExists(atPath: modelURL.path) else {
                            self?.phase = .failed("建模流程已结束，但没有找到 USDZ 文件。请重试并保持物品完整入镜。")
                            continue
                        }
                        self.phase = .completed
                        self.progress = 1
                        self.message = "3D 模型已生成，可以保存并打开预览。"
                    case .requestError(_, let error):
                        self?.phase = .failed("模型生成失败：\(error.localizedDescription)")
                    case .processingCancelled:
                        self?.phase = .failed("模型生成已取消。")
                    default:
                        break
                    }
                }
                if let self, self.phase == .processing {
                    self.phase = .failed("建模输出未完成，请检查光线、纹理和拍摄覆盖范围后重试。")
                }
            } catch {
                self?.phase = .failed("模型生成失败：\(error.localizedDescription)")
            }
            self?.photogrammetrySession = nil
        }
    }
}

struct ObjectScanView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var model = ObjectScanModel()
    @StateObject private var store = ObjectScanStore()
    @State private var scanName = ""
    @State private var isFilesPresented = false
    @State private var isPreviewPresented = false
    @State private var isImporterPresented = false
    @State private var previewURL: URL?
    @State private var statusMessage = ""
    @State private var isStatusPresented = false
    @State private var isLivePreviewExpanded = false

    var body: some View {
        NavigationStack {
            Group {
                if !model.isSupported {
                    unsupportedView
                } else if model.phase == .idle {
                    introView
                } else {
                    captureView
                }
            }
            .navigationTitle("静物3D扫描")
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
                    .accessibilityLabel("已保存静物3D模型")
                }
            }
        }
        .sheet(isPresented: $isFilesPresented) {
            ObjectScanFilesView(
                store: store,
                onOpen: open(record:),
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
        .alert("静物3D扫描", isPresented: $isStatusPresented) {
            Button("知道了", role: .cancel) {}
        } message: {
            Text(statusMessage)
        }
        .task(id: model.session.id) {
            await model.observeState()
        }
        .task(id: model.session.id) {
            await model.observeShotCount()
        }
        .task(id: model.session.id) {
            await model.observeScanPass()
        }
    }

    private var introView: some View {
        ContentUnavailableView {
            Label("静物3D扫描", systemImage: "cube.transparent")
        } description: {
            Text("适合家具、设备、摆件和器件等单件物品。开始后围绕物品缓慢移动，保持光线和纹理稳定。")
        } actions: {
            Button {
                model.start()
            } label: {
                Label("开始扫描", systemImage: "camera.viewfinder")
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(24)
    }

    private var unsupportedView: some View {
        ContentUnavailableView(
            "设备不支持静物扫描",
            systemImage: "camera.metering.unknown",
            description: Text("当前 iPhone 无法运行 Object Capture。仍可使用家装设计 3D 扫描、DWG 查看和 CAD 测量。")
        )
        .padding(24)
    }

    private var captureView: some View {
        Group {
            if model.phase == .detecting || model.phase == .capturing {
                scanningContent
            } else if let modelURL = model.modelURL {
                ZStack(alignment: .bottom) {
                    RoomScanSceneView(url: modelURL)
                        .ignoresSafeArea()
                    VStack(spacing: 10) {
                        scanStatusCard
                        controls
                    }
                    .padding(12)
                }
            } else {
                processingContent
            }
        }
        .background(Color.black)
    }

    private var scanningContent: some View {
        ScrollView {
            VStack(spacing: 12) {
                scanStatusCard
                liveCapturePanel
                controls
            }
            .padding(12)
        }
        .background(Color.black)
    }

    private var processingContent: some View {
        VStack(spacing: 16) {
            scanStatusCard
            controls
            Spacer()
        }
        .padding(12)
        .foregroundStyle(.white)
    }

    private var scanStatusCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("静物3D扫描", systemImage: "cube.transparent")
                    .font(.headline)
                Spacer()
                Text(phaseTitle)
                    .foregroundStyle(.cyan)
            }
            Text(model.message)
                .font(.footnote)
                .fixedSize(horizontal: false, vertical: true)
            if model.phase == .detecting || model.phase == .capturing {
                ProgressView(value: model.captureProgress) {
                    Text(captureProgressTitle)
                }
                .tint(.cyan)
                .animation(.easeOut(duration: 0.2), value: model.captureProgress)
            } else if model.phase == .processing {
                ProgressView(value: model.progress) {
                    Text("正在生成 3D 模型")
                }
                .tint(.cyan)
            }
        }
        .foregroundStyle(.white)
        .padding(12)
        .background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 14))
    }

    private var liveCapturePanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("实时扫描画面", systemImage: "camera.viewfinder")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Button(isLivePreviewExpanded ? "收起" : "放大") {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        isLivePreviewExpanded.toggle()
                    }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
            ObjectCaptureView(session: model.session)
                .frame(maxWidth: .infinity)
                .frame(height: isLivePreviewExpanded ? 430 : 285)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay {
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(.white.opacity(0.22), lineWidth: 1)
                }
        }
        .padding(10)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))
    }

    @ViewBuilder
    private var controls: some View {
        switch model.phase {
        case .detecting:
            Button {
                model.startCapturing()
            } label: {
                Label("开始绕物拍摄", systemImage: "record.circle")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.orange)
        case .capturing:
            Button {
                model.finish()
            } label: {
                Label("完成扫描", systemImage: "checkmark.circle.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.cyan)
        case .processing:
            EmptyView()
        case .completed:
            completedControls
        case .failed:
            Button("重新开始") { model.reset() }
                .buttonStyle(.borderedProminent)
        case .idle:
            EmptyView()
        }
    }

    private var completedControls: some View {
        VStack(spacing: 8) {
            Text("模型已生成，当前画面就是 3D 预览。")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.white)
            TextField("名称，例如：现场设备", text: $scanName)
                .textFieldStyle(.roundedBorder)
            HStack(spacing: 8) {
                if previewURL == nil {
                    Button {
                        saveModel()
                    } label: {
                        Label("保存到文件", systemImage: "externaldrive.badge.plus")
                    }
                    .buttonStyle(.borderedProminent)
                } else if let previewURL {
                    ShareLink(item: previewURL) {
                        Label("分享 / 云端", systemImage: "square.and.arrow.up")
                    }
                    .buttonStyle(.borderedProminent)
                }
                if model.modelURL != nil {
                    Button {
                        isPreviewPresented = true
                    } label: {
                        Label("全屏预览", systemImage: "rotate.3d")
                    }
                    .buttonStyle(.bordered)
                }
                Button("重新扫描") { model.reset() }
                    .buttonStyle(.bordered)
            }
        }
        .padding(12)
        .background(.black.opacity(0.86), in: RoundedRectangle(cornerRadius: 14))
    }

    private var phaseTitle: String {
        switch model.phase {
        case .idle: return "准备中"
        case .detecting: return "识别中"
        case .capturing: return "拍摄中"
        case .processing: return "建模中"
        case .completed: return "已完成"
        case .failed: return "不可用"
        }
    }

    private var captureProgressTitle: String {
        if model.hasCompletedScanPass {
            return "已完成一圈 · 可补拍后结束"
        }
        if model.maximumShotCount > 0 {
            return "已采集 \(model.shotCount) / \(model.maximumShotCount) 张"
        }
        return "已采集 \(model.shotCount) 张"
    }

    private func saveModel() {
        guard let modelURL = model.modelURL else { return }
        do {
            let (record, savedURL) = try store.save(modelURL: modelURL, displayName: scanName, shotCount: model.shotCount)
            previewURL = savedURL
            statusMessage = "已保存到本机扫描文件：\(record.displayName).usdz\n可点击右上角文件夹再次打开，或使用“分享 / 云端”发送到 Files、Google Drive、阿里云盘等已安装服务。"
            isStatusPresented = true
        } catch {
            statusMessage = "保存失败：\(error.localizedDescription)"
            isStatusPresented = true
        }
    }

    private func open(record: ObjectScanRecord) {
        guard let url = store.url(for: record) else {
            statusMessage = "静物3D模型文件已不存在，请重新导入或扫描。"
            isStatusPresented = true
            return
        }
        previewURL = url
        isFilesPresented = false
        isPreviewPresented = true
    }

    private func importFileResult(_ result: Result<[URL], Error>) {
        do {
            guard let sourceURL = try result.get().first else { return }
            let (_, url) = try store.importUSDZ(from: sourceURL)
            previewURL = url
            isPreviewPresented = true
        } catch {
            statusMessage = "导入失败：\(error.localizedDescription)"
            isStatusPresented = true
        }
    }
}

private struct ObjectScanFilesView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: ObjectScanStore
    let onOpen: (ObjectScanRecord) -> Void
    let onImport: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button {
                        onImport()
                        dismiss()
                    } label: {
                        Label("从 Files 导入 USDZ 模型", systemImage: "folder.badge.plus")
                    }
                }
                Section("本机已保存") {
                    if store.records.isEmpty {
                        ContentUnavailableView(
                            "暂无静物3D模型",
                            systemImage: "cube.transparent",
                            description: Text("完成静物扫描并保存后，模型会出现在这里。")
                        )
                    } else {
                        ForEach(store.records) { record in
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Image(systemName: "cube.transparent")
                                        .foregroundStyle(.orange)
                                    Text(record.displayName)
                                        .font(.subheadline.weight(.semibold))
                                        .lineLimit(1)
                                    Spacer()
                                }
                                Text(record.shotCount > 0
                                     ? "拍摄 \(record.shotCount) 张 · \(record.createdAt.formatted(date: .abbreviated, time: .shortened))"
                                     : "导入模型 · \(record.createdAt.formatted(date: .abbreviated, time: .shortened))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                HStack {
                                    Button("打开3D") { onOpen(record) }
                                        .buttonStyle(.borderedProminent)
                                        .controlSize(.small)
                                    if let url = store.url(for: record) {
                                        ShareLink(item: url) {
                                            Label("分享 / 云端", systemImage: "square.and.arrow.up")
                                        }
                                        .buttonStyle(.bordered)
                                        .controlSize(.small)
                                    }
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
            .navigationTitle("静物3D模型文件")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { dismiss() }
                }
            }
        }
    }
}

/// Supplies an immediate filename placeholder while a share extension reads
/// the local USDZ/JSON file. This avoids a blank first presentation on iOS
/// when the extension has not cached the app's file URL yet.
final class LiteCADShareItemSource: NSObject, UIActivityItemSource {
    let url: URL

    init(url: URL) {
        self.url = url
    }

    func activityViewControllerPlaceholderItem(
        _ activityViewController: UIActivityViewController
    ) -> Any {
        url.lastPathComponent
    }

    func activityViewController(
        _ activityViewController: UIActivityViewController,
        itemForActivityType activityType: UIActivity.ActivityType?
    ) -> Any? {
        url
    }

    func activityViewController(
        _ activityViewController: UIActivityViewController,
        subjectForActivityType activityType: UIActivity.ActivityType?
    ) -> String {
        url.lastPathComponent
    }
}
#endif
