#if os(iOS)
import Foundation
import SwiftUI

@main
struct LiteCADAppMain: App {
    var body: some Scene {
        WindowGroup {
            if let previewURL = launchUSDZURL {
                ThreeDScanPreviewView(url: previewURL)
            } else if launchRoomScan {
                ThreeDScanHubView()
            } else {
#if LITECAD_LIBREDWG_ENABLED
                LiteCADDocumentView(
                    loader: LibreDWGDocumentLoader(),
                    initialURL: launchTestURL
                )
#else
                LiteCADDocumentView(loader: UnavailableCADDocumentLoader())
#endif
            }
        }
    }

    private var launchRoomScan: Bool {
        ProcessInfo.processInfo.arguments.contains("--room-scan")
    }

    private var launchUSDZURL: URL? {
        let arguments = ProcessInfo.processInfo.arguments
        guard let marker = arguments.firstIndex(of: "--test-usdz"),
              arguments.indices.contains(marker + 1) else {
            return nil
        }

        let suppliedPath = arguments[marker + 1]
        if suppliedPath.hasPrefix("/") {
            return URL(fileURLWithPath: suppliedPath)
        }

        let applicationSupportURL = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        )[0]
        return applicationSupportURL.appendingPathComponent(suppliedPath)
    }

    private var launchTestURL: URL? {
        let arguments = ProcessInfo.processInfo.arguments
        guard let marker = arguments.firstIndex(of: "--test-dwg"),
              arguments.indices.contains(marker + 1) else {
            return nil
        }

        let suppliedPath = arguments[marker + 1]
        if suppliedPath.hasPrefix("/") {
            return URL(fileURLWithPath: suppliedPath)
        }

        let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let relativePath = suppliedPath.hasPrefix("Documents/")
            ? String(suppliedPath.dropFirst("Documents/".count))
            : suppliedPath
        return documentsURL.appendingPathComponent(relativePath)
    }
}
#endif
