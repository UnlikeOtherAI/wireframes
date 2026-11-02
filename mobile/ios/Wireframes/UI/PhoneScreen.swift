import SwiftUI

/// Two screens side by side. The chat and the page slide across each other.
struct PhoneScreen: View {
    @EnvironmentObject private var model: AppModel
    @State private var dragOffset: CGFloat = 0

    var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            HStack(spacing: 0) {
                // VoiceOver must not read the screen that has slid out of view.
                phoneChat.frame(width: width)
                    .accessibilityHidden(model.showingPreview)
                phonePreview.frame(width: width)
                    .accessibilityHidden(!model.showingPreview)
            }
            .frame(width: width, alignment: .leading)
            .offset(x: (model.showingPreview ? -width : 0) + dragOffset)
        }
        .background(Theme.background.ignoresSafeArea())
    }

    /// Only a clearly sideways drag moves the screens, so scrolling is left alone.
    private var slide: some Gesture {
        DragGesture(minimumDistance: 16)
            .onChanged { value in
                guard !model.interactive, abs(value.translation.width) > abs(value.translation.height) * 1.5 else { return }
                let width = value.translation.width
                dragOffset = model.showingPreview ? max(width, 0) : min(width, 0)
            }
            .onEnded { value in
                let moved = value.predictedEndTranslation.width
                let threshold: CGFloat = 80
                withAnimation(.spring(duration: 0.3)) { dragOffset = 0 }
                guard !model.interactive else { return }
                if !model.showingPreview, moved < -threshold { model.showPreview(true) }
                if model.showingPreview, moved > threshold { model.showPreview(false) }
            }
    }

    /// Sits behind a bar's controls, so dragging the bar slides and its buttons and menus still open.
    private var slideArea: some View {
        Color.clear
            .contentShape(Rectangle())
            .gesture(slide)
    }

    private var phoneChat: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                IconButton(systemName: "folder", label: "Projects") { model.openProjects() }
                    .accessibilityIdentifier("chat.projects")
                Spacer()
                Text(model.project?.name ?? "")
                    .font(Theme.projectTitle)
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                Spacer()
                IconButton(systemName: "square.and.pencil", label: "New chat", enabled: model.work == nil) { model.newChat() }
                    .accessibilityIdentifier("chat.new")
            }
            .padding(.horizontal, 4)
            .background(slideArea)
            Segments(
                options: [false, true],
                selected: model.showingPreview,
                title: { $0 ? "Preview" : "Chat" },
                identifier: { $0 ? "pager.preview" : "pager.chat" },
                onSelect: { model.showPreview($0) }
            )
            .padding(.bottom, 4)
            ChatColumn(showsLiveCard: true)
                .simultaneousGesture(slide)
            VStack(spacing: 8) {
                WorkStatus()
                Composer(placeholder: "Describe a change")
            }
            .padding(.horizontal, Theme.spacing)
            .padding(.bottom, 8)
        }
    }

    private var phonePreview: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                Button {
                    model.setInteractive(false)
                    model.showPreview(false)
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                        Text("Chat")
                    }
                    .font(Theme.body)
                    .foregroundStyle(Theme.ink)
                    .frame(minHeight: Theme.touchTarget)
                    .padding(.horizontal, 8)
                    .contentShape(Rectangle())
                }
                .accessibilityIdentifier("preview.back")
                Spacer()
                PagePicker()
                Spacer()
                OverflowMenu()
            }
            .padding(.horizontal, 4)
            .background(slideArea)
            Rectangle().fill(Theme.hairline).frame(height: Theme.hairlineWidth)
            HStack(spacing: 8) {
                Segments(
                    options: [ViewerMode.phone, .desktop],
                    selected: model.mode,
                    title: { $0.title },
                    identifier: { "viewer.\($0.rawValue)" },
                    onSelect: { model.setMode($0) }
                )
                RotateButton()
                Spacer(minLength: 0)
                Text("Interactive")
                    .font(Theme.label)
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Toggle("Interactive", isOn: Binding(get: { model.interactive }, set: { model.setInteractive($0) }))
                    .labelsHidden()
                    .tint(Theme.clay)
                    .accessibilityIdentifier("viewer.interactive")
            }
            .padding(.horizontal, 8)
            pageArea
            if !model.interactive && (model.selection != nil || model.work != nil) {
                VStack(spacing: 8) {
                    WorkStatus()
                    if model.selection != nil { Composer(placeholder: "What should change?") }
                }
                .padding(.horizontal, Theme.spacing)
                .padding(.vertical, 8)
            }
        }
    }

    private var pageArea: some View {
        GeometryReader { geometry in
            ViewerSurface(
                slot: .preview,
                active: model.activeSlot == .preview,
                host: model.host,
                layout: model.viewerLayout(available: geometry.size),
                touches: true,
                snapshot: model.snapshot
            )
            .onChange(of: geometry.size, initial: true) { _, size in
                if model.showingPreview { model.previewAreaChanged(size) }
            }
            .overlay(alignment: .leading) {
                // A strip to slide back on that the page itself never receives.
                if !model.interactive {
                    Color.clear
                        .frame(width: 20)
                        .contentShape(Rectangle())
                        .gesture(slide)
                        .accessibilityIdentifier("preview.rail")
                }
            }
        }
        .background(Theme.canvas)
        .ignoresSafeArea(.container, edges: model.selection != nil || model.work != nil ? [] : .bottom)
    }
}
