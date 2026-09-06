import SwiftUI
import WebKit

final class Bridge: NSObject, WKScriptMessageHandler, ObservableObject {
    let process = Process()
    var pipeIn = Pipe()
    var pipeOut = Pipe()
    weak var webView: WKWebView?

    func start() {
        guard let worker = Bundle.main.url(forResource: "getme-worker", withExtension: nil) else { return }
        process.executableURL = worker
        process.standardInput = pipeIn
        process.standardOutput = pipeOut
        process.standardError = FileHandle.standardError
        pipeOut.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
            for line in text.split(separator: "\n") {
                let escaped = line.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "'", with: "\\'")
                DispatchQueue.main.async { self?.webView?.evaluateJavaScript("window.postMessage(JSON.parse('\(escaped)'), '*')") }
            }
        }
        try? process.run()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            self.webView?.evaluateJavaScript("window.postMessage({event:'bridgeReady'},'*')")
        }
    }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let dict = message.body as? [String: Any], let data = try? JSONSerialization.data(withJSONObject: dict) else { return }
        pipeIn.fileHandleForWriting.write(data); pipeIn.fileHandleForWriting.write(Data([10]))
    }
    deinit { pipeOut.fileHandleForReading.readabilityHandler = nil; process.terminate() }
}

struct ContentView: NSViewRepresentable {
    @ObservedObject var bridge: Bridge
    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration(); config.userContentController.add(bridge, name: "bridge")
        let view = WKWebView(frame: .zero, configuration: config); bridge.webView = view
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") { view.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent()) }
        DispatchQueue.main.async { bridge.start() }; return view
    }
    func updateNSView(_ nsView: WKWebView, context: Context) {}
}

@main struct GetMeApp: App {
    @StateObject private var bridge = Bridge()
    var body: some Scene { WindowGroup { ContentView(bridge: bridge).frame(minWidth: 980, minHeight: 700) }.commands { CommandGroup(replacing: .appInfo) { } } }
}
