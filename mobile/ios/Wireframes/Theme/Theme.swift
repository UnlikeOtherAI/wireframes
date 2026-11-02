import SwiftUI

/// Every colour and metric in the app. Nothing else defines one.
enum Theme {
    static let background = dynamic(light: 0xFAF6F1, dark: 0x1A1A1B)
    static let surface = dynamic(light: 0xFFFDFA, dark: 0x242425)
    static let raised = dynamic(light: 0xF2ECE4, dark: 0x2F2F31)
    static let userBubble = dynamic(light: 0xEFE5DB, dark: 0x343436)
    static let canvas = dynamic(light: 0xF3EEE7, dark: 0x141415)
    static let ink = dynamic(light: 0x2A2521, dark: 0xEDEAE6)
    static let secondaryInk = dynamic(light: 0x6B625A, dark: 0xA8A49F)
    static let hairline = dynamic(light: 0xE3DAD0, dark: 0x3C3C3E)
    static let clay = dynamic(light: 0xA2604A, dark: 0xCE8667)
    static let onClay = dynamic(light: 0xFFFFFF, dark: 0x1A1412)
    static let danger = dynamic(light: 0xA83A30, dark: 0xE5786C)

    /// The selection outline drawn inside the page, which has no dynamic colours.
    static let selectionHex = "#A2604A"

    static let radius: CGFloat = 16
    static let controlRadius: CGFloat = 12
    static let touchTarget: CGFloat = 44
    static let hairlineWidth: CGFloat = 1
    static let spacing: CGFloat = 16

    static let projectTitle = Font.system(.title3, design: .serif).weight(.medium)
    static let pageTitle = Font.system(.title3, design: .serif).weight(.medium)
    static let body = Font.system(.body)
    static let label = Font.system(.subheadline).weight(.medium)
    static let caption = Font.system(.footnote)

    private static func dynamic(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}
