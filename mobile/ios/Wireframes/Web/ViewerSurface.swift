import SwiftUI
import WebKit

/// One place the page can appear. Only the active slot holds the web view; any other
/// slot shows the last snapshot, so a slide between screens never leaves a hole.
enum ViewerSlot: Hashable {
    case card
    case preview
    case tablet
}

struct ViewerSurface: UIViewRepresentable {
    let slot: ViewerSlot
    let active: Bool
    let host: WebHost
    let layout: ViewerLayout
    let touches: Bool
    let snapshot: UIImage?

    func makeUIView(context: Context) -> ViewerContainer { ViewerContainer() }

    func updateUIView(_ view: ViewerContainer, context: Context) {
        view.update(webView: host.webView, active: active, layout: layout, touches: touches, snapshot: snapshot)
    }
}

/// The stable UIKit view that owns placement, so SwiftUI never fights over the web view.
final class ViewerContainer: UIView {
    private let snapshotView = UIImageView()
    private var layoutValue = ViewerLayout(size: .zero, scale: 1)
    private weak var attached: WKWebView?

    override init(frame: CGRect) {
        super.init(frame: frame)
        clipsToBounds = true
        snapshotView.contentMode = .scaleAspectFit
        addSubview(snapshotView)
    }

    required init?(coder: NSCoder) { fatalError("Not used from a storyboard.") }

    func update(webView: WKWebView, active: Bool, layout: ViewerLayout, touches: Bool, snapshot: UIImage?) {
        layoutValue = layout
        snapshotView.image = snapshot
        snapshotView.isHidden = active
        if active {
            if webView.superview !== self {
                webView.removeFromSuperview()
                webView.transform = .identity
                addSubview(webView)
            }
            attached = webView
            webView.isUserInteractionEnabled = touches
        } else if attached === webView {
            attached = nil
        }
        setNeedsLayout()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let center = CGPoint(x: bounds.midX, y: bounds.midY)
        let fitted = CGSize(width: layoutValue.size.width * layoutValue.scale, height: layoutValue.size.height * layoutValue.scale)
        snapshotView.frame = CGRect(x: center.x - fitted.width / 2, y: center.y - fitted.height / 2, width: fitted.width, height: fitted.height)
        guard let webView = attached, webView.superview === self else { return }
        // Bounds carry the page's real size and the transform shrinks all of it as one.
        webView.transform = .identity
        webView.bounds = CGRect(origin: .zero, size: layoutValue.size)
        webView.center = center
        webView.transform = CGAffineTransform(scaleX: layoutValue.scale, y: layoutValue.scale)
    }
}
