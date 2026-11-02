import CoreGraphics

/// The one place page size and shrink are decided. The page lays out at `size`, and the
/// whole viewer is scaled to fit. Nothing inside the page knows it has been scaled.
struct ViewerLayout: Equatable {
    var size: CGSize
    var scale: CGFloat

    static func devicePreset(_ mode: ViewerMode, landscape: Bool) -> CGSize? {
        let portrait: CGSize
        switch mode {
        case .fill: return nil
        case .phone: portrait = CGSize(width: 390, height: 844)
        case .tablet: portrait = CGSize(width: 820, height: 1180)
        case .desktop: return CGSize(width: 1280, height: 900)
        }
        return landscape ? CGSize(width: portrait.height, height: portrait.width) : portrait
    }

    static func compute(mode: ViewerMode, landscape: Bool, available: CGSize) -> ViewerLayout {
        guard let size = devicePreset(mode, landscape: landscape) else {
            return ViewerLayout(size: available, scale: 1)
        }
        return ViewerLayout(size: size, scale: fitScale(size: size, available: available))
    }

    /// Shrinks only: a viewer that already fits stays at full size.
    static func fitScale(size: CGSize, available: CGSize) -> CGFloat {
        guard size.width > 0, size.height > 0, available.width > 0, available.height > 0 else { return 1 }
        return min(1, available.width / size.width, available.height / size.height)
    }

    /// What the page host is told to lay out as.
    static func viewport(mode: ViewerMode, landscape: Bool, size: CGSize) -> [String: Any] {
        var viewport: [String: Any] = ["width": Int(size.width.rounded()), "height": Int(size.height.rounded())]
        let device: String
        switch mode {
        case .phone: device = "mobile"
        case .tablet: device = "tablet"
        case .desktop: device = "web"
        case .fill: device = size.width < 600 ? "mobile" : (size.width < 1000 ? "tablet" : "web")
        }
        viewport["device"] = device
        if device != "web" { viewport["orientation"] = size.width > size.height ? "landscape" : "portrait" }
        return viewport
    }
}
