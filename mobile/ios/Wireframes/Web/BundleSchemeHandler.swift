import UniformTypeIdentifiers
import WebKit

/// Serves the bundled page host and icons. It is the only thing the web view can load,
/// so a page has no way to reach the network.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "wf-app"

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url, url.host == "web",
              let root = Bundle.main.resourceURL?.appendingPathComponent("dist").standardizedFileURL else {
            task.didFailWithError(URLError(.badURL))
            return
        }
        let file = root.appendingPathComponent(url.path).standardizedFileURL
        guard file.path.hasPrefix(root.path + "/"), let data = try? Data(contentsOf: file) else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        let type = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: [
            "Content-Type": type,
            "Content-Length": String(data.count),
            "Access-Control-Allow-Origin": "*",
        ])!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}
