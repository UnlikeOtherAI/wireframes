import SwiftUI

/// The conversation. On a phone it includes the live card; on a tablet the page is
/// already beside it, so it does not.
struct ChatColumn: View {
    @EnvironmentObject private var model: AppModel
    let showsLiveCard: Bool

    var body: some View {
        ScrollViewReader { reader in
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if model.messages.isEmpty && !hasDesign && model.modelReady {
                        Text("Describe what you want to design.")
                            .font(Theme.body)
                            .foregroundStyle(Theme.secondaryInk)
                            .padding(.top, 8)
                            .accessibilityIdentifier("chat.empty")
                    }
                    ForEach(model.messages) { message in
                        MessageRow(message: message, showsThumbnail: showsLiveCard && message.revision != model.project?.revision)
                            .id(message.id)
                    }
                    if showsLiveCard && hasDesign {
                        LiveCard()
                    }
                    if model.failedRequest != nil {
                        Button("Try again") { model.retry() }
                            .font(Theme.label)
                            .foregroundStyle(Theme.clay)
                            .frame(minHeight: Theme.touchTarget)
                            .accessibilityIdentifier("chat.retry")
                    }
                    if model.showsMetrics {
                        Text(model.lastMetrics)
                            .font(.caption2)
                            .foregroundStyle(Theme.secondaryInk)
                            .accessibilityIdentifier("debug.metrics")
                    }
                    if !model.modelReady && !centresBanner {
                        ModelBanner()
                    }
                    Color.clear.frame(height: 1).id("bottom")
                }
                .padding(.horizontal, Theme.spacing)
                .padding(.vertical, 8)
            }
            .overlay {
                if !model.modelReady && centresBanner {
                    ModelBanner()
                        .padding(.horizontal, Theme.spacing)
                        .frame(maxWidth: 440)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: model.messages.count) {
                withAnimation { reader.scrollTo("bottom", anchor: .bottom) }
            }
            .onAppear { reader.scrollTo("bottom", anchor: .bottom) }
        }
    }

    private var hasDesign: Bool { model.project?.canUndo == true || !model.messages.isEmpty }

    /// An empty chat has nothing else to offer, so the download sits in the middle of it.
    private var centresBanner: Bool { model.messages.isEmpty && !(showsLiveCard && hasDesign) }
}

struct MessageRow: View {
    @EnvironmentObject private var model: AppModel
    let message: ChatMessage
    let showsThumbnail: Bool

    var body: some View {
        if message.isUser {
            HStack {
                Spacer(minLength: 44)
                Text(message.text)
                    .font(Theme.body)
                    .foregroundStyle(Theme.ink)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Theme.userBubble, in: RoundedRectangle(cornerRadius: Theme.radius))
                    .accessibilityIdentifier("chat.user")
            }
        } else {
            VStack(alignment: .leading, spacing: 8) {
                Text(message.text)
                    .font(Theme.body)
                    .foregroundStyle(Theme.ink)
                    .accessibilityIdentifier("chat.assistant")
                if showsThumbnail, message.revision != 0, let image = model.cardSnapshots[message.revision] {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .frame(maxHeight: 120)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.hairline, lineWidth: Theme.hairlineWidth))
                        .accessibilityLabel(Text("An earlier version"))
                }
                if message.revision != 0, message.revision == model.project?.revision {
                    Button("Undo") { model.undo() }
                        .font(Theme.label)
                        .foregroundStyle(Theme.clay)
                        .frame(minHeight: Theme.touchTarget)
                        .disabled(model.work != nil)
                        .accessibilityIdentifier("chat.undo")
                }
            }
        }
    }
}

/// The real page, shrunk. Tapping it anywhere opens the full preview.
struct LiveCard: View {
    @EnvironmentObject private var model: AppModel
    private let bodyHeight: CGFloat = 340

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(model.currentPageTitle)
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                Spacer(minLength: 8)
                VersionMenu()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 2)
            Rectangle().fill(Theme.hairline).frame(height: Theme.hairlineWidth)
            Button {
                model.showPreview(true)
            } label: {
                GeometryReader { geometry in
                    ViewerSurface(
                        slot: .card,
                        active: model.activeSlot == .card,
                        host: model.host,
                        layout: model.viewerLayout(available: geometry.size),
                        touches: false,
                        snapshot: model.snapshot
                    )
                }
                .frame(height: bodyHeight)
                .background(Theme.canvas)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text("Open the full preview"))
            .accessibilityIdentifier("chat.liveCard")
        }
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.radius))
        .clipShape(RoundedRectangle(cornerRadius: Theme.radius))
        .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.hairline, lineWidth: Theme.hairlineWidth))
        .shadow(color: .black.opacity(0.05), radius: 10, y: 3)
    }
}
