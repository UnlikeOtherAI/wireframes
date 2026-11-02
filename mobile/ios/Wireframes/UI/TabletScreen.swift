import SwiftUI

/// Chat beside the page. The page is always live, and hiding the chat gives it everything.
struct TabletScreen: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 0) {
                if !model.chatHidden {
                    leftColumn
                        .frame(width: max(320, geometry.size.width / 3))
                        .transition(.move(edge: .leading))
                    Rectangle().fill(Theme.hairline).frame(width: Theme.hairlineWidth)
                }
                page
            }
        }
        .background(Theme.background.ignoresSafeArea())
    }

    @ViewBuilder
    private var leftColumn: some View {
        switch model.leftPanel {
        case .chat: chat
        case .projects: ProjectsBrowser()
        }
    }

    private var chat: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                IconButton(systemName: "sidebar.left", label: "Hide chat") { model.setChatHidden(true) }
                    .accessibilityIdentifier("tablet.hideChat")
                IconButton(systemName: "folder", label: "Projects") { model.openProjects() }
                    .accessibilityIdentifier("tablet.projects")
                Spacer(minLength: 4)
                Text(model.project?.name ?? "")
                    .font(Theme.projectTitle)
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                Spacer(minLength: 4)
                IconButton(systemName: "square.and.pencil", label: "New chat", enabled: model.work == nil) { model.newChat() }
                    .accessibilityIdentifier("chat.new")
            }
            .padding(.horizontal, 4)
            ChatColumn(showsLiveCard: false)
            VStack(spacing: 8) {
                WorkStatus()
                Composer(placeholder: "Describe a change")
            }
            .padding(.horizontal, Theme.spacing)
            .padding(.bottom, 8)
        }
    }

    private func topRow(sizes: some View) -> some View {
        HStack(spacing: 8) {
            if model.chatHidden {
                IconButton(systemName: "sidebar.left", label: "Show chat") { model.setChatHidden(false) }
                    .accessibilityIdentifier("tablet.showChat")
                IconButton(systemName: "folder", label: "Projects") { model.openProjects() }
                    .accessibilityIdentifier("tablet.projectsHidden")
            }
            PagePicker()
            Spacer(minLength: 8)
            sizes
            RotateButton()
            SaveVersionButton()
            VersionMenu()
            OverflowMenu()
        }
    }

    private var segments: some View {
        Segments(
            options: ViewerMode.allCases,
            selected: model.mode,
            title: { $0.title },
            identifier: { "viewer.\($0.rawValue)" },
            onSelect: { model.setMode($0) }
        )
    }

    private var sizesMenu: some View {
        Menu {
            ForEach(ViewerMode.allCases) { mode in
                Button { model.setMode(mode) } label: { Text(mode.title) }
                    .accessibilityIdentifier("viewer.\(mode.rawValue)")
            }
        } label: {
            HStack(spacing: 6) {
                Text(model.mode.title)
                    .font(Theme.label)
                    .fixedSize()
                Image(systemName: "chevron.down")
                    .font(.system(size: 11, weight: .semibold))
            }
            .foregroundStyle(Theme.onClay)
            .padding(.horizontal, 12)
            .frame(minHeight: 36)
            .background(Theme.clay, in: Capsule())
            .frame(minHeight: Theme.touchTarget)
        }
        .accessibilityIdentifier("viewer.menu")
    }

    private var page: some View {
        VStack(spacing: 0) {
            // Everything sits on one level with the title, so the page keeps the height.
            // A narrow iPad folds the sizes into a menu rather than truncating them.
            ViewThatFits(in: .horizontal) {
                topRow(sizes: segments)
                topRow(sizes: sizesMenu)
            }
            .padding(.horizontal, 12)
            Rectangle().fill(Theme.hairline).frame(height: Theme.hairlineWidth)
            GeometryReader { geometry in
                ViewerSurface(
                    slot: .tablet,
                    active: true,
                    host: model.host,
                    layout: model.viewerLayout(available: geometry.size),
                    touches: true,
                    snapshot: nil
                )
                .onChange(of: geometry.size, initial: true) { _, size in
                    model.previewAreaChanged(size)
                }
            }
            .background(Theme.canvas)
            .ignoresSafeArea(.container, edges: model.selection != nil && model.chatHidden ? [] : .bottom)
            if model.selection != nil && model.chatHidden {
                Composer(placeholder: "What should change?")
                    .padding(.horizontal, Theme.spacing)
                    .padding(.vertical, 8)
            }
        }
    }
}
