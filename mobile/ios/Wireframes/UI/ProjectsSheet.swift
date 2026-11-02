import SwiftUI

/// Every project, each opening to its pages. Lives in the left column on a tablet
/// and in a sheet on a phone.
struct ProjectsBrowser: View {
    @EnvironmentObject private var model: AppModel
    @State private var expanded: Set<Int64> = []
    @State private var pagesByProject: [Int64: [PageInfo]] = [:]
    @State private var renaming: ProjectSummary?
    @State private var deleting: ProjectSummary?
    @State private var newName = ""

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                Button("Done") { model.closeProjects() }
                    .font(Theme.label)
                    .foregroundStyle(Theme.clay)
                    .frame(minHeight: Theme.touchTarget)
                    .padding(.horizontal, 12)
                    .accessibilityIdentifier("projects.done")
                Spacer()
                Text("Projects")
                    .font(Theme.projectTitle)
                    .foregroundStyle(Theme.ink)
                Spacer()
                IconButton(systemName: "plus", label: "New project") {
                    Task {
                        await model.createProject()
                        model.closeProjects()
                    }
                }
                .accessibilityIdentifier("projects.new")
            }
            .padding(.horizontal, 4)
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(model.projects) { summary in
                        row(summary)
                    }
                }
                .padding(Theme.spacing)
            }
        }
        .background(Theme.background)
        .alert("Rename project", isPresented: Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })) {
            TextField("Name", text: $newName)
            Button("Cancel", role: .cancel) {}
            Button("Rename") {
                if let renaming { model.rename(renaming, to: newName) }
            }
        }
        .confirmationDialog(
            "Delete this project?",
            isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
            titleVisibility: .visible
        ) {
            Button("Delete project", role: .destructive) {
                if let deleting { Task { await model.delete(deleting) } }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Its pages, versions and chats will be gone.")
        }
    }

    private func row(_ summary: ProjectSummary) -> some View {
        let isCurrent = summary.id == model.project?.id
        let isOpen = expanded.contains(summary.id)
        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 0) {
                Button {
                    toggle(summary)
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .rotationEffect(.degrees(isOpen ? 90 : 0))
                        .foregroundStyle(Theme.secondaryInk)
                        .frame(width: 36, height: Theme.touchTarget)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel(Text(isOpen ? "Hide pages" : "Show pages"))
                .accessibilityIdentifier("projects.expand")
                Button {
                    Task {
                        await model.open(summary)
                        model.closeProjects()
                    }
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: isCurrent ? "folder.fill" : "folder")
                            .foregroundStyle(isCurrent ? Theme.clay : Theme.secondaryInk)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(summary.name)
                                .font(.headline)
                                .foregroundStyle(Theme.ink)
                                .lineLimit(1)
                            Text("\(summary.revisions) versions")
                                .font(Theme.caption)
                                .foregroundStyle(Theme.secondaryInk)
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: Theme.touchTarget, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .accessibilityIdentifier("projects.open")
                IconButton(systemName: "pencil", label: "Rename") {
                    newName = summary.name
                    renaming = summary
                }
                .accessibilityIdentifier("projects.rename")
                IconButton(systemName: "trash", label: "Delete") { deleting = summary }
                    .accessibilityIdentifier("projects.delete")
            }
            if isOpen, let pages = pagesByProject[summary.id] {
                Rectangle().fill(Theme.hairline).frame(height: Theme.hairlineWidth)
                VStack(alignment: .leading, spacing: 2) {
                    PageTreeRows(
                        nodes: PageTreeNode.build(pages),
                        current: isCurrent ? model.currentPage : nil,
                        onSelect: { page in
                            Task {
                                await model.open(summary, page: page.id)
                                model.closeProjects()
                            }
                        }
                    )
                }
                .padding(8)
            }
        }
        .padding(.vertical, 4)
        .background(isCurrent ? Theme.raised : Theme.surface, in: RoundedRectangle(cornerRadius: Theme.controlRadius))
        .overlay(RoundedRectangle(cornerRadius: Theme.controlRadius).stroke(Theme.hairline, lineWidth: Theme.hairlineWidth))
    }

    private func toggle(_ summary: ProjectSummary) {
        if expanded.contains(summary.id) {
            withAnimation(.easeInOut(duration: 0.2)) { _ = expanded.remove(summary.id) }
            return
        }
        Task {
            pagesByProject[summary.id] = await model.pages(of: summary)
            withAnimation(.easeInOut(duration: 0.2)) { _ = expanded.insert(summary.id) }
        }
    }
}

/// The phone's way in to the browser.
struct ProjectsSheet: View {
    var body: some View {
        ProjectsBrowser()
            .tint(Theme.clay)
    }
}

/// How this project's pages are drawn.
struct RenderingSheet: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack {
                Text("Page style")
                    .font(Theme.projectTitle)
                    .foregroundStyle(Theme.ink)
                Spacer()
                Button("Done") { dismiss() }
                    .font(Theme.label)
                    .foregroundStyle(Theme.clay)
                    .frame(minHeight: Theme.touchTarget)
                    .accessibilityIdentifier("rendering.done")
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("Corners")
                    .font(Theme.label)
                    .foregroundStyle(Theme.ink)
                Segments(
                    options: RenderingStyle.Corners.allCases,
                    selected: model.rendering.corners,
                    title: { $0 == .rounded ? "Rounded" : "Square" },
                    identifier: { "rendering.corners.\($0.rawValue)" },
                    onSelect: { value in
                        var next = model.rendering
                        next.corners = value
                        model.setRendering(next)
                    }
                )
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("Boxes")
                    .font(Theme.label)
                    .foregroundStyle(Theme.ink)
                Segments(
                    options: RenderingStyle.Mode.allCases,
                    selected: model.rendering.mode,
                    title: { $0 == .card ? "Cards" : "Lines" },
                    identifier: { "rendering.mode.\($0.rawValue)" },
                    onSelect: { value in
                        var next = model.rendering
                        next.mode = value
                        model.setRendering(next)
                    }
                )
            }
            Toggle(isOn: Binding(get: { model.rendering.adapt }, set: { value in
                var next = model.rendering
                next.adapt = value
                model.setRendering(next)
            })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Adapt to smaller sizes")
                        .font(Theme.label)
                        .foregroundStyle(Theme.ink)
                    Text("Rearranges a page shown smaller than it was designed for.")
                        .font(Theme.caption)
                        .foregroundStyle(Theme.secondaryInk)
                }
            }
            .tint(Theme.clay)
            .accessibilityIdentifier("rendering.adapt")
            Text("This changes how this project is drawn, not the design itself.")
                .font(Theme.caption)
                .foregroundStyle(Theme.secondaryInk)
            Spacer(minLength: 0)
        }
        .padding(20)
        .background(Theme.background)
        .presentationDetents([.medium])
        .tint(Theme.clay)
    }
}
