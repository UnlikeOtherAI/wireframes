import SwiftUI

/// Getting the model, in the chat, where it is what stands between someone and designing.
struct ModelBanner: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        Card { content }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("model.banner")
    }

    @ViewBuilder
    private var content: some View {
        switch model.availability {
        case .checking:
            ProgressView()
        case .unsupported:
            title("This device can't run the offline designer")
            detail("It needs at least 8 GB of memory. You can still open and export projects here.")
        case .needsStorage(let bytes):
            title("Not enough storage")
            detail("The offline designer needs \(Self.size(bytes)) free. Free up some space, then try again.")
            PrimaryButton(title: "Try again") { model.checkModel() }
                .accessibilityIdentifier("model.recheck")
        case .available(let file):
            forPhase(file: file)
        }
    }

    @ViewBuilder
    private func forPhase(file: ModelFile) -> some View {
        switch model.installer.phase {
        case .idle:
            title("Download the offline model")
            detail("It runs on this device, so you can design with no connection. \(Self.size(file.bytes)) on Wi-Fi.")
            PrimaryButton(title: "Download offline model") { model.downloadModel() }
                .accessibilityIdentifier("model.download")
        case .downloading(let done, let total):
            progress(title: "Downloading the offline model", done: done, total: total)
            detail("You can leave the app. We'll keep your progress.")
            SecondaryButton(title: "Pause") { model.installer.pause() }
                .accessibilityIdentifier("model.pause")
        case .paused(let done, let total):
            progress(title: "Download paused", done: done, total: total)
            PrimaryButton(title: "Resume") { model.installer.resume() }
                .accessibilityIdentifier("model.resume")
        case .waitingForWiFi(let total):
            title("Waiting for Wi-Fi")
            detail("The download continues as soon as you are connected.")
            SecondaryButton(title: "Use mobile data, \(Self.size(total))") { model.installer.useCellular() }
                .accessibilityIdentifier("model.cellular")
        case .checking(let done, let total):
            progress(title: "Checking the download", done: done, total: total)
        case .failed:
            title("The download didn't finish")
            detail("Check your connection, then try again.")
            PrimaryButton(title: "Try again") { model.installer.retry() }
                .accessibilityIdentifier("model.retry")
        case .installed:
            EmptyView()
        }
    }

    private func title(_ text: LocalizedStringKey) -> some View {
        Text(text)
            .font(.headline)
            .foregroundStyle(Theme.ink)
    }

    private func detail(_ text: LocalizedStringKey) -> some View {
        Text(text)
            .font(Theme.caption)
            .foregroundStyle(Theme.secondaryInk)
    }

    private func progress(title text: LocalizedStringKey, done: UInt64, total: UInt64) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            title(text)
            ProgressView(value: Double(done), total: Double(max(total, 1)))
                .tint(Theme.clay)
                .accessibilityIdentifier("model.progress")
            Text("\(Self.size(done)) of \(Self.size(total))")
                .font(Theme.caption)
                .foregroundStyle(Theme.secondaryInk)
                .monospacedDigit()
        }
    }

    private static func size(_ bytes: UInt64) -> String {
        ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file)
    }
}
