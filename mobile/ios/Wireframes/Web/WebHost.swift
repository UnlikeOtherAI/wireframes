import UIKit
import WebKit

/// Owns the one web view in the app. It holds the page host, so it stays alive for the
/// whole session and is moved between the places that show it.
@MainActor
final class WebHost: NSObject {
    let webView: WKWebView
    private var ready = false
    private var readyWaiters: [CheckedContinuation<Void, Never>] = []
    private var renderWaiters: [CheckedContinuation<Bool, Never>] = []

    var onSelection: ((Selection?) -> Void)?
    var onRendered: ((String, [PageInfo]) -> Void)?
    var onError: ((String) -> Void)?
    var onProcessTerminated: (() -> Void)?

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: BundleSchemeHandler.scheme)
        configuration.websiteDataStore = .nonPersistent()
        webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 390, height: 844), configuration: configuration)
        super.init()
        configuration.userContentController.add(LeakAvoidingHandler(self), name: "wf")
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.accessibilityIdentifier = "page.webview"
        let press = UILongPressGestureRecognizer(target: self, action: #selector(longPressed(_:)))
        press.minimumPressDuration = 0.45
        press.cancelsTouchesInView = false
        press.delegate = self
        webView.addGestureRecognizer(press)
        load()
    }

    @objc private func longPressed(_ gesture: UILongPressGestureRecognizer) {
        guard gesture.state == .began else { return }
        // The web view's bounds are the page's real size, so this ignores any shrink.
        let point = gesture.location(in: webView)
        Task { await call("selectAt", [Double(point.x), Double(point.y)]) }
    }

    private func load() {
        ready = false
        webView.load(URLRequest(url: URL(string: "\(BundleSchemeHandler.scheme)://web/host.html")!))
    }

    func waitUntilReady() async {
        if ready { return }
        await withCheckedContinuation { readyWaiters.append($0) }
    }

    func handle(_ message: [String: Any]) {
        switch message["type"] as? String {
        case "ready":
            ready = true
            Task { await call("setAccent", [Theme.selectionHex]) }
            readyWaiters.forEach { $0.resume() }
            readyWaiters.removeAll()
        case "rendered":
            let pages = decode([PageInfo].self, message["pages"]) ?? []
            onRendered?(message["page"] as? String ?? "", pages)
            renderWaiters.forEach { $0.resume(returning: true) }
            renderWaiters.removeAll()
        case "selection":
            onSelection?(decode(Selection.self, message["selection"]))
        case "error":
            onError?(message["message"] as? String ?? "")
            renderWaiters.forEach { $0.resume(returning: false) }
            renderWaiters.removeAll()
        default:
            break
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, _ value: Any?) -> T? {
        guard let value, !(value is NSNull), let data = try? JSONSerialization.data(withJSONObject: value) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    @discardableResult
    private func call(_ function: String, _ arguments: [Any?]) async -> Any? {
        await waitUntilReady()
        var names: [String] = []
        var values: [String: Any] = [:]
        for (index, argument) in arguments.enumerated() {
            let name = "a\(index)"
            names.append(name)
            values[name] = argument ?? NSNull()
        }
        return try? await webView.callAsyncJavaScript(
            "return wfHost.\(function)(\(names.joined(separator: ",")))",
            arguments: values,
            contentWorld: .page
        )
    }

    /// Show a project, and wait until the page has actually drawn.
    func load(wf: String, page: String?) async -> Bool {
        await waitUntilReady()
        return await withCheckedContinuation { continuation in
            renderWaiters.append(continuation)
            Task { await call("load", [wf, page]) }
        }
    }

    func setPage(_ page: String) async { await call("setPage", [page]) }

    func setViewport(_ viewport: [String: Any]) async { await call("setViewport", [viewport]) }

    func setRendering(corners: String, mode: String, adapt: Bool) async {
        await call("setRendering", [["corners": corners, "mode": mode, "adapt": adapt] as [String: Any]])
    }

    func pages(of wf: String) async -> [PageInfo] {
        decode([PageInfo].self, await call("pagesOf", [wf])) ?? []
    }

    func setPointing(_ pointing: String) async { await call("setPointing", [pointing]) }

    func clearSelection() async { await call("clearSelection", []) }

    func applyEdit(wf: String, output: String, page: String) async -> EditResult {
        let value = await call("applyEdit", [wf, output, page])
        return decode(EditResult.self, value)
            ?? EditResult(ok: false, wf: nil, page: nil, changes: nil, diagnostics: [EditDiagnostic(code: "EDIT_FAILED", message: "The edit could not be read.")])
    }

    func context(wf: String, page: String, source: String?) async -> ModelContext? {
        decode(ModelContext.self, await call("contextFor", [wf, page, source]))
    }

    func newProject(name: String) async -> String? { await call("newProject", [name]) as? String }

    func elementSheet() async -> String { await call("elementSheet", []) as? String ?? "" }

    func snapshot() async -> UIImage? {
        await withCheckedContinuation { continuation in
            webView.takeSnapshot(with: nil) { image, _ in continuation.resume(returning: image) }
        }
    }
}

extension WebHost: UIGestureRecognizerDelegate {
    nonisolated func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
}

extension WebHost: WKNavigationDelegate {
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        load()
        onProcessTerminated?()
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let scheme = navigationAction.request.url?.scheme
        decisionHandler(scheme == BundleSchemeHandler.scheme || scheme == "about" ? .allow : .cancel)
    }
}

/// A script handler retains its target, which would otherwise keep the host alive forever.
private final class LeakAvoidingHandler: NSObject, WKScriptMessageHandler {
    weak var host: WebHost?
    init(_ host: WebHost) { self.host = host }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        // Only the trusted host page may talk to native, never the prototype in its frame.
        guard message.frameInfo.isMainFrame, let body = message.body as? [String: Any] else { return }
        MainActor.assumeIsolated { host?.handle(body) }
    }
}
