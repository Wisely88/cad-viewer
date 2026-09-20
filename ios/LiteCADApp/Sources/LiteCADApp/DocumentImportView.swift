#if os(iOS)
import LiteCADCore
import CoreText
import SwiftUI
import UIKit
import UniformTypeIdentifiers

public struct CADDXFDocument: FileDocument {
    public static var readableContentTypes: [UTType] { [.plainText] }

    public var text: String

    public init(text: String = "") {
        self.text = text
    }

    public init(configuration: ReadConfiguration) throws {
        text = String(
            data: configuration.file.regularFileContents ?? Data(),
            encoding: .utf8
        ) ?? ""
    }

    public func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: Data(text.utf8))
    }
}

private extension UTType {
    static var liteCADDXF: UTType {
        UTType(filenameExtension: "dxf", conformingTo: .plainText) ?? .plainText
    }
}

public struct LiteCADDocumentView<Loader: CADDocumentLoader>: View {
    @Environment(\.scenePhase) private var scenePhase
    private let loader: Loader
    private let initialURL: URL?
    @State private var isImporterPresented = false
    @State private var session = CADDocumentSession()
    @State private var interactionMode: CADInteractionMode = .pan
    @State private var measurementTool: CADMeasurementTool = .distance
    @State private var measurementPoints: [CADPoint] = []
    @State private var areaMeasurement: CADAreaMeasurement?
    @State private var angleMeasurement: CADAngleMeasurement?
    @State private var coordinatePoint: CADPoint?
    @State private var calibrationDistance: Float?
    @State private var knownLengthText = ""
    @State private var isCalibrationPromptPresented = false
    @State private var measurementScale: Float = 1
    @State private var measurementUnit = "图纸单位"
    @State private var fitRequest = 0
    @State private var snapshotRequest = 0
    @State private var focusRequest = 0
    @State private var focusPoint: CADPoint?
    @State private var hiddenLayers = Set<UInt16>()
    @State private var measurement: CADMeasurement?
    @State private var pathMeasurement: CADPathMeasurement?
    @State private var circleMeasurement: CADCircleMeasurement?
    @State private var pendingMeasurementPoint: CADPoint?
    @State private var snapEnabled = true
    @State private var pendingSnapResult: CADSnapResult?
    @State private var isLayerPanelPresented = false
    @State private var loadedFileName = ""
    @State private var selection: CADSelectionResult?
    @State private var markups: [CADMarkup] = []
    @State private var markupDraft = ""
    @State private var isMarkupPromptPresented = false
    @State private var textFontMode: CADTextFontMode = .system
    @State private var isFontPanelPresented = false
    @State private var isFontImporterPresented = false
    @State private var customFontName: String?
    @State private var fontStatusMessage = ""
    @State private var currentLayerID: UInt16?
    @State private var editHistory = CADEditHistory()
    @State private var isMovePromptPresented = false
    @State private var isRotatePromptPresented = false
    @State private var isDuplicatePromptPresented = false
    @State private var isDeletePromptPresented = false
    @State private var editDeltaX = "0"
    @State private var editDeltaY = "0"
    @State private var editAngle = "90"
    @State private var editOperations: [CADEditOperation] = []
    @State private var redoEditOperations: [CADEditOperation] = []
    @State private var editingDocumentURL: URL?
    @State private var activeLoadID = UUID()
    @State private var activeLoadTask: Task<Void, Never>?
    @State private var isExporterPresented = false
    @State private var exportDocument = CADDXFDocument()
    @State private var exportFileName = "LiteCAD-export.dxf"
    @State private var exportStatusMessage = ""
    @State private var isExportStatusPresented = false
    @State private var historyRecords: [CADDocumentHistoryRecord] = []
    @State private var isHistoryPanelPresented = false
    @State private var historyStatusMessage = ""
    @State private var isHistoryStatusPresented = false
    @State private var isTextSearchPresented = false
    @State private var isSnapshotSharePresented = false
    @State private var isRoomScanPresented = false
    @State private var shareItems: [Any] = []
    @State private var advancedEditingEnabled = false
    private let editStore = CADDocumentEditStore()
    private let historyStore = CADDocumentHistoryStore()

    public init(loader: Loader, initialURL: URL? = nil) {
        self.loader = loader
        self.initialURL = initialURL
    }

    public var body: some View {
        NavigationStack {
            content
                .navigationTitle("LiteCAD")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Menu {
                            Button("撤销") { undoEdit() }
                                .disabled(!editHistory.canUndo)
                            Button("重做") { redoEdit() }
                                .disabled(!editHistory.canRedo)
                            Divider()
                            Button("导出 DXF 副本") { exportDXF() }
                                .disabled(!canCloseDocument)
                            Button("分享现场图") { snapshotRequest += 1 }
                                .disabled(!canCloseDocument)
                            Divider()
                            Button("历史记录") { isHistoryPanelPresented = true }
                            Toggle("高级编辑", isOn: $advancedEditingEnabled)
                        } label: {
                            Image(systemName: "arrow.uturn.backward.circle")
                        }
                        .accessibilityLabel("编辑历史")
                    }
                    ToolbarItemGroup(placement: .topBarTrailing) {
                        Button {
                            closeDocument()
                        } label: {
                            Image(systemName: "xmark.circle")
                        }
                        .disabled(!canCloseDocument)
                        .accessibilityLabel("关闭文件")
                        Button("打开文件") {
                            isImporterPresented = true
                        }
                        Button {
                            isRoomScanPresented = true
                        } label: {
                            Image(systemName: "cube.transparent")
                        }
                        .accessibilityLabel("3D 扫描工具")
                    }
                }
                .fileImporter(
                    isPresented: $isImporterPresented,
                    allowedContentTypes: [.data],
                    allowsMultipleSelection: false,
                    onCompletion: importResult
                )
                .fileExporter(
                    isPresented: $isExporterPresented,
                    document: exportDocument,
                    contentType: .liteCADDXF,
                    defaultFilename: exportFileName,
                    onCompletion: exportResult
                )
                .sheet(isPresented: $isHistoryPanelPresented) {
                    CADHistoryListView(
                        records: historyRecords,
                        onOpen: { record in
                            isHistoryPanelPresented = false
                            Task { @MainActor in await openHistory(record) }
                        },
                        onDelete: { record in
                            historyRecords = historyStore.remove(record)
                        }
                    )
                    .presentationDetents([.medium, .large])
                }
                .alert("历史记录", isPresented: $isHistoryStatusPresented) {
                    Button("知道了", role: .cancel) {}
                } message: {
                    Text(historyStatusMessage)
                }
                .sheet(isPresented: $isRoomScanPresented) {
                    ThreeDScanHubView()
                }
        }
        .preferredColorScheme(.dark)
        .task(id: initialURL) {
            historyRecords = historyStore.load()
            guard let initialURL else { return }
            beginLoad(url: initialURL)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch session.state {
        case .idle:
            VStack(spacing: 18) {
                ContentUnavailableView(
                    "尚未打开图纸",
                    systemImage: "square.and.arrow.down",
                    description: Text("从 Files 选择本地图纸文件，或从历史记录重新打开。")
                )
                CADHistoryListView(
                    records: historyRecords,
                    onOpen: { record in
                        Task { @MainActor in await openHistory(record) }
                    },
                    onDelete: { record in
                        historyRecords = historyStore.remove(record)
                    }
                )
            }
        case let .loading(fileName):
            VStack(spacing: 14) {
                ProgressView("正在读取 " + fileName + "…")
                Button("取消读取") {
                    cancelLoading()
                }
                .buttonStyle(.bordered)
                .tint(.orange)
            }
        case let .loaded(scene):
            GeometryReader { proxy in
                ZStack(alignment: .topLeading) {
                    metalDocumentView(scene: scene)
                        .frame(width: proxy.size.width, height: proxy.size.height)

                    VStack(spacing: 10) {
                        documentContextBar(for: scene)
                        Spacer()
                        if interactionMode == .measure {
                            measurementStatusCard
                        }
                        if interactionMode == .select, let selection {
                            selectionStatusCard(selection: selection, scene: scene)
                        }
                        HStack(spacing: 8) {
                            toolButton("移动", systemImage: "hand.draw", mode: .pan)
                            toolButton("测量", systemImage: "ruler", mode: .measure)
                            toolButton("选择", systemImage: "cursorarrow", mode: .select)
                            toolButton("批注", systemImage: "plus.bubble", mode: .markup)
                            commandButton("全图", systemImage: "viewfinder") {
                                fitRequest += 1
                            }
                            commandButton("查找", systemImage: "magnifyingglass") {
                                isTextSearchPresented = true
                            }
                            commandButton("图层", systemImage: "square.3.layers.3d") {
                                isLayerPanelPresented = true
                            }
                        commandButton("文字", systemImage: "textformat") {
                            isFontPanelPresented = true
                        }
                        }
                        .padding(8)
                        .background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 18))
                    }
                    .padding(.horizontal, 12)
                    .padding(.bottom, 12)
                }
                .frame(width: proxy.size.width, height: proxy.size.height)
            }
            .background(Color(red: 0.035, green: 0.045, blue: 0.06))
            .colorScheme(.dark)
            .ignoresSafeArea(edges: .bottom)
            .sheet(isPresented: $isLayerPanelPresented) {
                CADLayerPanel(
                    layers: scene.layers,
                    hiddenLayers: $hiddenLayers,
                    currentLayerID: $currentLayerID
                )
                .presentationDetents([.medium, .large])
            }
            .sheet(isPresented: $isFontPanelPresented) {
                CADFontPanel(
                    mode: $textFontMode,
                    customFontName: customFontName,
                    statusMessage: fontStatusMessage,
                    onImport: { isFontImporterPresented = true }
                )
                    .presentationDetents([.medium])
            }
            .sheet(isPresented: $isTextSearchPresented) {
                CADTextSearchPanel(scene: scene) { result in
                    focusPoint = result.point
                    focusRequest += 1
                    isTextSearchPresented = false
                }
                .presentationDetents([.medium, .large])
            }
            .sheet(isPresented: $isSnapshotSharePresented) {
                CADShareSheet(items: shareItems)
            }
            .fileImporter(
                isPresented: $isFontImporterPresented,
                allowedContentTypes: [.font],
                allowsMultipleSelection: false,
                onCompletion: importFontResult
            )
            .alert("导出结果", isPresented: $isExportStatusPresented) {
                Button("知道了", role: .cancel) {}
            } message: {
                Text(exportStatusMessage)
            }
            .alert("移动选中对象", isPresented: $isMovePromptPresented) {
                TextField("ΔX", text: $editDeltaX)
                    .keyboardType(.numbersAndPunctuation)
                TextField("ΔY", text: $editDeltaY)
                    .keyboardType(.numbersAndPunctuation)
                Button("应用") { applyMove() }
                Button("取消", role: .cancel) {}
            } message: {
                Text("输入图纸坐标中的位移")
            }
            .alert("旋转选中对象", isPresented: $isRotatePromptPresented) {
                TextField("角度（度）", text: $editAngle)
                    .keyboardType(.numbersAndPunctuation)
                Button("应用") { applyRotate() }
                Button("取消", role: .cancel) {}
            } message: {
                Text("绕选择点旋转，正数为逆时针")
            }
            .alert("复制选中对象", isPresented: $isDuplicatePromptPresented) {
                TextField("ΔX", text: $editDeltaX)
                    .keyboardType(.numbersAndPunctuation)
                TextField("ΔY", text: $editDeltaY)
                    .keyboardType(.numbersAndPunctuation)
                Button("复制") { applyDuplicate() }
                Button("取消", role: .cancel) {}
            } message: {
                Text("复制会保留原对象，并按位移生成新对象")
            }
            .confirmationDialog(
                "删除当前选择？",
                isPresented: $isDeletePromptPresented,
                titleVisibility: .visible
            ) {
                Button("删除", role: .destructive) { applyDelete() }
                Button("取消", role: .cancel) {}
            }
            .alert("添加批注", isPresented: $isMarkupPromptPresented) {
                TextField("输入现场备注", text: $markupDraft)
                Button("添加") {
                    if let point = pendingMeasurementPoint,
                       !markupDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        markups.append(CADMarkup(point: point, text: markupDraft))
                    }
                    pendingMeasurementPoint = nil
                }
                Button("取消", role: .cancel) { pendingMeasurementPoint = nil }
            }
            .alert("比例校准", isPresented: $isCalibrationPromptPresented) {
                TextField("已知真实长度", text: $knownLengthText)
                    .keyboardType(.decimalPad)
                TextField("单位（例如 mm）", text: $measurementUnit)
                Button("保存") {
                    guard let raw = calibrationDistance,
                          let known = Float(knownLengthText), raw > 0, known > 0 else { return }
                    measurementScale = known / raw
                }
                Button("取消", role: .cancel) {}
            } message: {
                Text("先前两点的图纸距离为 \(calibrationDistance.map { String(format: "%.4f", $0) } ?? "-")。输入这两点对应的真实长度。")
            }
        case let .failed(message):
            ContentUnavailableView(
                "无法打开图纸",
                systemImage: "exclamationmark.triangle",
                description: Text(message)
            )
        }
    }

    private func importResult(_ result: Result<[URL], Error>) {
        do {
            let urls = try result.get()
            guard let url = urls.first else {
                session.fail(message: CADDocumentLoaderError.noFileSelected.localizedDescription)
                return
            }

            beginLoad(url: url)
        } catch {
            session.fail(message: error.localizedDescription)
        }
    }

    private func metalDocumentView(scene: CADScene) -> LiteCADMetalView {
        LiteCADMetalView(
            scene: scene,
            isActive: scenePhase == .active,
            viewport: initialViewport(for: scene),
            interactionMode: interactionMode,
            fitRequest: fitRequest,
            focusRequest: focusRequest,
            focusPoint: focusPoint,
            snapshotRequest: snapshotRequest,
            hiddenLayers: hiddenLayers,
            measurement: measurement,
            pathMeasurement: pathMeasurement,
            circleMeasurement: circleMeasurement,
            pendingMeasurementPoint: pendingMeasurementPoint,
            measurementTool: measurementTool,
            measurementPoints: measurementPoints,
            areaMeasurement: areaMeasurement,
            angleMeasurement: angleMeasurement,
            coordinatePoint: coordinatePoint,
            snapEnabled: snapEnabled,
            pendingSnapResult: pendingSnapResult,
            selection: selection,
            markups: markups,
            textFontMode: textFontMode,
            customFontName: customFontName,
            onMeasurement: { measurement = $0 },
            onPendingMeasurementPoint: { pendingMeasurementPoint = $0 },
            onSnap: { pendingSnapResult = $0 },
            onAreaMeasurement: {
                areaMeasurement = $0
                measurementPoints = []
            },
            onPathMeasurement: {
                pathMeasurement = $0
                measurementPoints = []
            },
            onCircleMeasurement: {
                circleMeasurement = $0
                measurementPoints = []
            },
            onAngleMeasurement: {
                angleMeasurement = $0
                measurementPoints = []
            },
            onCoordinatePoint: { coordinatePoint = $0 },
            onCalibrationDistance: {
                calibrationDistance = $0
                knownLengthText = ""
                isCalibrationPromptPresented = true
            },
            onSelection: { selection = $0 },
            onMarkupPoint: { point in
                guard let point else { return }
                pendingMeasurementPoint = point
                markupDraft = ""
                isMarkupPromptPresented = true
            },
            onSnapshot: handleSnapshot
        )
    }

    private var canCloseDocument: Bool {
        if case .idle = session.state { return false }
        return true
    }

    private func closeDocument() {
        activeLoadTask?.cancel()
        activeLoadTask = nil
        activeLoadID = UUID()
        isImporterPresented = false
        isLayerPanelPresented = false
        isFontPanelPresented = false
        isFontImporterPresented = false
        isCalibrationPromptPresented = false
        isMarkupPromptPresented = false
        isMovePromptPresented = false
        isRotatePromptPresented = false
        isDuplicatePromptPresented = false
        isDeletePromptPresented = false
        session = CADDocumentSession()
        loadedFileName = ""
        editingDocumentURL = nil
        editHistory.removeAll()
        editOperations.removeAll()
        redoEditOperations.removeAll()
        hiddenLayers.removeAll()
        measurement = nil
        pathMeasurement = nil
        circleMeasurement = nil
        pendingMeasurementPoint = nil
        pendingSnapResult = nil
        measurementPoints.removeAll()
        areaMeasurement = nil
        angleMeasurement = nil
        coordinatePoint = nil
        calibrationDistance = nil
        selection = nil
        markups.removeAll()
        currentLayerID = nil
        fitRequest += 1
    }

    private func exportDXF() {
        guard let scene = currentLoadedScene() else { return }
        do {
            exportDocument = CADDXFDocument(text: try CADSceneDXFExporter.string(for: scene))
            let sourceName = loadedFileName.isEmpty ? "LiteCAD" : (loadedFileName as NSString).deletingPathExtension
            exportFileName = "\(sourceName)-edited.dxf"
            isExporterPresented = true
        } catch {
            exportStatusMessage = error.localizedDescription
            isExportStatusPresented = true
        }
    }

    private func exportResult(_ result: Result<URL, Error>) {
        switch result {
        case let .success(url):
            exportStatusMessage = "已导出 DXF 副本：\(url.lastPathComponent)"
            isExportStatusPresented = true
        case let .failure(error) where (error as NSError).code != CocoaError.userCancelled.rawValue:
            exportStatusMessage = error.localizedDescription
            isExportStatusPresented = true
        case .failure:
            break
        }
    }

    private func load(url: URL) async {
        let loadID = UUID()
        activeLoadID = loadID
        session.beginLoading(fileName: url.lastPathComponent)
        let hasAccess = url.startAccessingSecurityScopedResource()
        defer {
            if hasAccess { url.stopAccessingSecurityScopedResource() }
        }

        do {
            let selectedLoader = loader
            let scene = try await Task.detached(priority: .userInitiated) {
                try await selectedLoader.load(url: url)
            }.value
            guard !Task.isCancelled, activeLoadID == loadID else { return }
            var restoredScene = scene
            var restoredHistory = CADEditHistory()
            var restoredOperations: [CADEditOperation] = []
            for operation in editStore.load(for: url) {
                guard let nextScene = operation.applying(to: restoredScene) else { continue }
                restoredHistory.record(before: restoredScene)
                restoredScene = nextScene
                restoredOperations.append(operation)
            }
            editHistory = restoredHistory
            editOperations = restoredOperations
            redoEditOperations = []
            editingDocumentURL = url
            try? editStore.save(restoredOperations, for: url)

            interactionMode = .pan
            fitRequest += 1
            hiddenLayers.removeAll()
            measurement = nil
            pathMeasurement = nil
            circleMeasurement = nil
            pendingMeasurementPoint = nil
            pendingSnapResult = nil
            measurementPoints = []
            areaMeasurement = nil
            angleMeasurement = nil
            coordinatePoint = nil
            calibrationDistance = nil
            selection = nil
            markups = []
            loadedFileName = url.lastPathComponent
            currentLayerID = scene.layers.first?.id
            session.finishLoading(scene: restoredScene)
            historyRecords = historyStore.recordOpened(url)
        } catch is CancellationError {
            return
        } catch {
            guard activeLoadID == loadID else { return }
            session.fail(message: error.localizedDescription)
        }
    }

    private func beginLoad(url: URL) {
        activeLoadTask?.cancel()
        activeLoadTask = Task { @MainActor in
            await load(url: url)
            activeLoadTask = nil
        }
    }

    private func cancelLoading() {
        activeLoadTask?.cancel()
        activeLoadTask = nil
        activeLoadID = UUID()
        session = CADDocumentSession()
    }

    private func handleSnapshot(_ image: UIImage) {
        shareItems = [image]
        isSnapshotSharePresented = true
    }

    private func openHistory(_ record: CADDocumentHistoryRecord) async {
        guard let url = historyStore.resolve(record) else {
            historyStatusMessage = "无法访问“\(record.fileName)”。请从 Files 重新选择这个文件。"
            isHistoryStatusPresented = true
            return
        }
        beginLoad(url: url)
    }

    private func currentLoadedScene() -> CADScene? {
        guard case let .loaded(scene) = session.state else { return nil }
        return scene
    }

    private func commitEdit(_ nextScene: CADScene, operation: CADEditOperation) {
        guard let current = currentLoadedScene(), current != nextScene else { return }
        editHistory.record(before: current)
        editOperations.append(operation)
        redoEditOperations.removeAll()
        if let editingDocumentURL {
            try? editStore.save(editOperations, for: editingDocumentURL)
        }
        session.finishLoading(scene: nextScene)
        selection = nil
        pendingMeasurementPoint = nil
        measurement = nil
    }

    private func undoEdit() {
        guard let current = currentLoadedScene(),
              let previous = editHistory.undo(current: current) else { return }
        if let operation = editOperations.popLast() {
            redoEditOperations.append(operation)
        }
        if let editingDocumentURL {
            try? editStore.save(editOperations, for: editingDocumentURL)
        }
        session.finishLoading(scene: previous)
        selection = nil
    }

    private func redoEdit() {
        guard let current = currentLoadedScene(),
              let next = editHistory.redo(current: current) else { return }
        if let operation = redoEditOperations.popLast() {
            editOperations.append(operation)
        }
        if let editingDocumentURL {
            try? editStore.save(editOperations, for: editingDocumentURL)
        }
        session.finishLoading(scene: next)
        selection = nil
    }

    private func applyMove() {
        guard let scene = currentLoadedScene(),
              let selection,
              let deltaX = Float(editDeltaX),
              let deltaY = Float(editDeltaY),
              let next = CADSceneEditor.move(
                  scene: scene,
                  selection: selection,
                  delta: CADPoint(x: deltaX, y: deltaY)
              ) else { return }
        commitEdit(
            next,
            operation: CADEditOperation(
                kind: .move,
                selection: CADSelectionDescriptor(selection: selection, in: scene),
                deltaX: deltaX,
                deltaY: deltaY
            )
        )
    }

    private func applyRotate() {
        guard let scene = currentLoadedScene(),
              let selection,
              let degrees = Float(editAngle),
              let next = CADSceneEditor.rotate(
                  scene: scene,
                  selection: selection,
                  radians: degrees * .pi / 180
              ) else { return }
        commitEdit(
            next,
            operation: CADEditOperation(
                kind: .rotate,
                selection: CADSelectionDescriptor(selection: selection, in: scene),
                radians: degrees * .pi / 180
            )
        )
    }

    private func applyDuplicate() {
        guard let scene = currentLoadedScene(),
              let selection,
              let deltaX = Float(editDeltaX),
              let deltaY = Float(editDeltaY),
              let next = CADSceneEditor.duplicate(
                  scene: scene,
                  selection: selection,
                  offset: CADPoint(x: deltaX, y: deltaY)
              ) else { return }
        commitEdit(
            next,
            operation: CADEditOperation(
                kind: .duplicate,
                selection: CADSelectionDescriptor(selection: selection, in: scene),
                deltaX: deltaX,
                deltaY: deltaY
            )
        )
    }

    private func applyDelete() {
        guard let scene = currentLoadedScene(),
              let selection,
              let next = CADSceneEditor.delete(scene: scene, selection: selection) else { return }
        commitEdit(
            next,
            operation: CADEditOperation(
                kind: .delete,
                selection: CADSelectionDescriptor(selection: selection, in: scene)
            )
        )
    }

    private func importFontResult(_ result: Result<[URL], Error>) {
        do {
            guard let sourceURL = try result.get().first else { return }
            let hasAccess = sourceURL.startAccessingSecurityScopedResource()
            defer { if hasAccess { sourceURL.stopAccessingSecurityScopedResource() } }
            let appSupport = try FileManager.default.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )
            let destination = appSupport.appendingPathComponent(sourceURL.lastPathComponent)
            if FileManager.default.fileExists(atPath: destination.path) {
                try FileManager.default.removeItem(at: destination)
            }
            try FileManager.default.copyItem(at: sourceURL, to: destination)
            var registrationError: Unmanaged<CFError>?
            guard CTFontManagerRegisterFontsForURL(
                destination as CFURL,
                .process,
                &registrationError
            ) else {
                fontStatusMessage = registrationError?.takeRetainedValue().localizedDescription ?? "字体注册失败"
                return
            }
            let descriptors = CTFontManagerCreateFontDescriptorsFromURL(destination as CFURL) as? [CTFontDescriptor]
            customFontName = descriptors?.first.flatMap { CTFontDescriptorCopyAttribute($0, kCTFontNameAttribute) as? String }
            textFontMode = .imported
            fontStatusMessage = "已载入：\(customFontName ?? sourceURL.lastPathComponent)"
        } catch {
            fontStatusMessage = error.localizedDescription
        }
    }

    private func initialViewport(for scene: CADScene) -> CADViewportState {
        var viewport = CADViewportState(viewportSize: CADPoint(x: 1_000, y: 1_000))
        viewport.fit(bounds: scene.focusBounds)
        return viewport
    }

    @ViewBuilder
    private func toolButton(
        _ title: String,
        systemImage: String,
        mode: CADInteractionMode
    ) -> some View {
        Button {
            interactionMode = mode
            measurement = nil
            pathMeasurement = nil
            circleMeasurement = nil
            pendingMeasurementPoint = nil
            pendingSnapResult = nil
            measurementPoints = []
            areaMeasurement = nil
            angleMeasurement = nil
            coordinatePoint = nil
            calibrationDistance = nil
            selection = nil
        } label: {
            VStack(spacing: 4) {
                Image(systemName: systemImage)
                    .font(.system(size: 18, weight: .semibold))
                Text(title)
                    .font(.caption2.weight(.medium))
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 52)
            .foregroundStyle(interactionMode == mode ? .white : .secondary)
            .background(
                interactionMode == mode
                    ? Color.accentColor.opacity(0.9)
                    : Color.white.opacity(0.08),
                in: RoundedRectangle(cornerRadius: 13)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }

    private func commandButton(
        _ title: String,
        systemImage: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: systemImage)
                    .font(.system(size: 18, weight: .semibold))
                Text(title)
                    .font(.caption2.weight(.medium))
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 52)
            .foregroundStyle(.secondary)
            .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 13))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }

    private var measurementStatusCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "scope")
                    .foregroundStyle(.yellow)
                Text("测量 · \(measurementTool.title)")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Menu {
                    ForEach(CADMeasurementTool.allCases) { tool in
                        Button(tool.title) {
                            measurementTool = tool
                            measurement = nil
                            pathMeasurement = nil
                            circleMeasurement = nil
                            measurementPoints = []
                            areaMeasurement = nil
                            angleMeasurement = nil
                            coordinatePoint = nil
                            pendingMeasurementPoint = nil
                        }
                    }
                } label: {
                    Label("工具", systemImage: "slider.horizontal.3")
                        .font(.caption.weight(.semibold))
                }
                if measurement != nil || pathMeasurement != nil || circleMeasurement != nil || pendingMeasurementPoint != nil || areaMeasurement != nil || angleMeasurement != nil || coordinatePoint != nil {
                    Button("重置") {
                        measurement = nil
                        pathMeasurement = nil
                        circleMeasurement = nil
                        pendingMeasurementPoint = nil
                        pendingSnapResult = nil
                        measurementPoints = []
                        areaMeasurement = nil
                        angleMeasurement = nil
                        coordinatePoint = nil
                        calibrationDistance = nil
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.yellow)
                }
            }
            if let measurement {
                Text("距离  \(formattedScaled(measurement.distance))")
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(.white)
                Text("ΔX \(formattedScaled(measurement.deltaX)) · ΔY \(formattedScaled(measurement.deltaY)) · 方向 \(measurement.formattedAngle)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            } else if let pathMeasurement {
                Text("连续距离  \(formattedScaled(pathMeasurement.totalDistance))")
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(.white)
            } else if let areaMeasurement {
                Text("面积  \(formattedScaled(areaMeasurement.area * measurementScale * measurementScale, squared: true))")
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(.white)
            } else if let angleMeasurement {
                Text("角度  \(String(format: "%.2f°", angleMeasurement.degrees))")
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(.white)
            } else if let coordinatePoint {
                Text("X \(formattedScaled(coordinatePoint.x))   Y \(formattedScaled(coordinatePoint.y))")
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(.white)
            } else {
                Text(measurementTool == .continuousDistance ? "连续点击路径点，双击完成测量" : measurementTool == .circle ? "依次点击圆周上三点，计算半径与直径" : measurementTool == .area ? "连续点击边界点，双击完成闭合" : measurementTool == .angle ? "依次点击两条边的起点、顶点、终点" : measurementTool == .coordinate ? "点击图面读取坐标" : measurementTool == .calibration ? "点击已知长度的起点和终点" : "点击图面选择起点，再点击终点")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            HStack(spacing: 12) {
                Button {
                    snapEnabled.toggle()
                } label: {
                    Label("对象吸附", systemImage: snapEnabled ? "dot.scope" : "scope")
                        .font(.caption.weight(.semibold))
                }
                .buttonStyle(.bordered)
                .tint(snapEnabled ? .green : .secondary)

                if let pendingSnapResult {
                    Text("已吸附：\(pendingSnapResult.kind.title)")
                        .font(.caption)
                        .foregroundStyle(.green)
                } else {
                    Text("可吸附端点、中点、线段")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            if !measurementPoints.isEmpty || pendingMeasurementPoint != nil {
                Button("撤销上一点") {
                    if !measurementPoints.isEmpty {
                        measurementPoints.removeLast()
                        pathMeasurement = nil
                        circleMeasurement = nil
                    } else {
                        pendingMeasurementPoint = nil
                        measurement = nil
                    }
                    pendingSnapResult = nil
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(.orange)
            }
            Text(measurementScale == 1 ? "结果按图纸原始单位计算，尚未校准比例" : "结果已按校准比例换算")
                .font(.caption2)
                .foregroundStyle(.secondary)
            if measurementScale != 1 {
                Text("已校准：1 图纸单位 = \(String(format: "%.4f", measurementScale)) \(measurementUnit)")
                    .font(.caption2)
                    .foregroundStyle(.green)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.black.opacity(0.86), in: RoundedRectangle(cornerRadius: 15))
    }

    private var measurementStatusTitle: String {
        if circleMeasurement != nil { return "圆量测完成" }
        if measurement != nil { return "测距完成" }
        if pendingMeasurementPoint != nil { return "已选择起点 · 点击终点" }
        return "测距 · 选择起点"
    }

    private func formattedScaled(_ value: Float, squared: Bool = false) -> String {
        let scaled = value * (squared ? measurementScale * measurementScale : measurementScale)
        let suffix = measurementScale == 1 ? "图纸单位" : (squared ? "\(measurementUnit)²" : measurementUnit)
        return String(format: "%.3f %@", scaled, suffix)
    }

    private func selectionStatusCard(selection: CADSelectionResult, scene: CADScene) -> some View {
        let layerName = scene.layers.first(where: { $0.id == selection.layerID })?.name ?? "Layer \(selection.layerID)"
        let canEdit = advancedEditingEnabled && (selection.instanceIndex != nil
            || selection.lineIndex != nil
            || selection.annotationIndex != nil
            || selection.fillIndex != nil)
        let selectionTitle: String = {
            switch selection.kind {
            case .line: return "LINE"
            case .text: return "TEXT / MTEXT / DIMENSION"
            case .fill: return "HATCH"
            }
        }()
        return VStack(alignment: .leading, spacing: 5) {
            Text("已选择 · \(selectionTitle)")
                .font(.subheadline.weight(.semibold))
            Text("图层：\(layerName) · 位置：\(String(format: "%.2f, %.2f", selection.point.x, selection.point.y))")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
            if let text = selection.text {
                Text(text)
                    .font(.caption)
                    .lineLimit(2)
            }
            HStack(spacing: 7) {
                editButton("移动", systemImage: "arrow.up.and.down.and.arrow.left.and.right") {
                    editDeltaX = "0"
                    editDeltaY = "0"
                    isMovePromptPresented = true
                }
                editButton("旋转", systemImage: "rotate.right") {
                    editAngle = "90"
                    isRotatePromptPresented = true
                }
                editButton("复制", systemImage: "plus.square.on.square") {
                    editDeltaX = "10"
                    editDeltaY = "10"
                    isDuplicatePromptPresented = true
                }
                editButton("删除", systemImage: "trash", destructive: true) {
                    isDeletePromptPresented = true
                }
            }
            .disabled(!canEdit)
            .opacity(canEdit ? 1 : 0.45)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.black.opacity(0.86), in: RoundedRectangle(cornerRadius: 15))
    }

    private func editButton(
        _ title: String,
        systemImage: String,
        destructive: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.caption2.weight(.semibold))
                .lineLimit(1)
        }
        .buttonStyle(.bordered)
        .tint(destructive ? .red : .cyan)
    }

    private func documentContextBar(for scene: CADScene) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "doc.text.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.cyan)
            VStack(alignment: .leading, spacing: 2) {
                Text(loadedFileName.isEmpty ? "本地图纸" : loadedFileName)
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
                Text("\(formattedCount(scene.storedLineCount)) 线 · \(formattedCount(scene.blockInstances.count)) 个 BLOCK · 本地离线")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            Image(systemName: "checkmark.circle.fill")
                .font(.caption)
                .foregroundStyle(.green)
                .accessibilityLabel("图纸已加载")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 13))
    }

    private func formattedCount(_ count: Int) -> String {
        if count >= 1_000_000 {
            return String(format: "%.2fM", Double(count) / 1_000_000)
        }
        if count >= 1_000 {
            return String(format: "%.1fk", Double(count) / 1_000)
        }
        return String(count)
    }
}

private struct CADHistoryListView: View {
    let records: [CADDocumentHistoryRecord]
    let onOpen: (CADDocumentHistoryRecord) -> Void
    let onDelete: (CADDocumentHistoryRecord) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("历史记录", systemImage: "clock.arrow.circlepath")
                    .font(.headline)
                Spacer()
                if !records.isEmpty {
                    Text("最近 \(records.count) 条")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            if records.isEmpty {
                ContentUnavailableView(
                    "暂无历史记录",
                    systemImage: "clock",
                    description: Text("打开文件后，最近记录会保存在这里。")
                )
                .frame(maxWidth: .infinity, minHeight: 140)
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(records) { record in
                            historyRow(record)
                        }
                    }
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(.black.opacity(0.22), in: RoundedRectangle(cornerRadius: 16))
    }

    private func historyRow(_ record: CADDocumentHistoryRecord) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "doc.text")
                .font(.title3)
                .foregroundStyle(.cyan)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(record.fileName)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text(record.lastOpened.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("本地 Files 文件")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            Button("打开") { onOpen(record) }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .accessibilityLabel("打开 \(record.fileName)")
            Button(role: .destructive) { onDelete(record) } label: {
                Image(systemName: "trash")
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .accessibilityLabel("删除 \(record.fileName) 的历史记录")
        }
        .padding(10)
        .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 12))
    }
}

private struct CADTextSearchPanel: View {
    let scene: CADScene
    let onSelect: (CADTextSearchResult) -> Void
    @State private var query = ""

    private var results: [CADTextSearchResult] {
        scene.textMatches(query: query)
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("输入标注、设备编号或文字", text: $query)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    ContentUnavailableView(
                        "搜索图纸标注",
                        systemImage: "magnifyingglass",
                        description: Text("输入文字后选择结果，图面会自动定位到对应位置。")
                    )
                } else if results.isEmpty {
                    ContentUnavailableView(
                        "没有匹配结果",
                        systemImage: "text.magnifyingglass",
                        description: Text("尝试输入设备编号、轴号或尺寸标注。")
                    )
                } else {
                    Section("匹配结果") {
                        ForEach(results) { result in
                            Button {
                                onSelect(result)
                            } label: {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(result.text)
                                        .font(.body.weight(.semibold))
                                        .lineLimit(2)
                                    Text("图层 \(result.layerID) · 点击定位")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .foregroundStyle(.primary)
                        }
                    }
                }
            }
            .navigationTitle("查找标注")
        }
    }
}

private struct CADShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

private struct CADLayerPanel: View {
    let layers: [CADLayer]
    @Binding var hiddenLayers: Set<UInt16>
    @Binding var currentLayerID: UInt16?
    @State private var searchText = ""

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("搜索图层名称或编号", text: $searchText)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.numberPad)
                }
                Section("图层") {
                    ForEach(filteredLayers) { layer in
                        HStack(spacing: 10) {
                            Circle()
                                .fill(layerColor(layer))
                                .frame(width: 10, height: 10)
                            Toggle(layer.name, isOn: visibilityBinding(for: layer.id))
                            if currentLayerID == layer.id {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(.green)
                            } else {
                                Button("当前") { currentLayerID = layer.id }
                                    .font(.caption2.weight(.semibold))
                                    .buttonStyle(.bordered)
                            }
                            Button("仅此") {
                                hiddenLayers = Set(layers.map(\.id).filter { $0 != layer.id })
                            }
                            .font(.caption.weight(.semibold))
                            .buttonStyle(.bordered)
                        }
                    }
                }
            }
            .navigationTitle("图层显隐")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("全部显示") { hiddenLayers.removeAll() }
                        Button("全部隐藏") { hiddenLayers = Set(layers.map(\.id)) }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
    }

    private var filteredLayers: [CADLayer] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return layers }
        return layers.filter { $0.name.localizedCaseInsensitiveContains(query) || String($0.id).contains(query) }
    }

    private func visibilityBinding(for layerID: UInt16) -> Binding<Bool> {
        Binding(
            get: { !hiddenLayers.contains(layerID) },
            set: { isVisible in
                if isVisible {
                    hiddenLayers.remove(layerID)
                } else {
                    hiddenLayers.insert(layerID)
                }
            }
        )
    }

    private func layerColor(_ layer: CADLayer) -> Color {
        guard layer.colorRGB != 0 else { return .cyan }
        let value = layer.colorRGB
        return Color(
            red: Double((value >> 16) & 0xff) / 255,
            green: Double((value >> 8) & 0xff) / 255,
            blue: Double(value & 0xff) / 255
        )
    }
}

private struct CADFontPanel: View {
    @Binding var mode: CADTextFontMode
    let customFontName: String?
    let statusMessage: String
    let onImport: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section("文字显示") {
                    ForEach(CADTextFontMode.allCases) { option in
                        Button {
                            mode = option
                        } label: {
                            HStack {
                                Text(option.title)
                                Spacer()
                                if mode == option { Image(systemName: "checkmark") }
                            }
                        }
                        .foregroundStyle(.primary)
                    }
                }
                Section("DWG 字体") {
                    Button("导入 TTF / OTF") { onImport() }
                    if let customFontName {
                        Text("当前：\(customFontName)")
                            .font(.footnote)
                    }
                    if !statusMessage.isEmpty {
                        Text(statusMessage)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    Text("SHX 当前按工程等宽规则显示；没有对应字形文件时不再把控制码直接绘制成乱码。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("文字与字体")
        }
    }
}
#endif
