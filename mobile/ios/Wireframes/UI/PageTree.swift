import SwiftUI

/// A page and the pages under its path.
struct PageTreeNode: Identifiable, Equatable {
    let page: PageInfo
    var children: [PageTreeNode]

    var id: String { page.id }

    /// /billing/invoices sits under /billing when that page exists, and at the top otherwise.
    static func build(_ pages: [PageInfo]) -> [PageTreeNode] {
        let paths = pages.map { (page: $0, segments: $0.path.split(separator: "/").map(String.init)) }
        func children(of parent: [String]) -> [PageTreeNode] {
            paths
                .filter { candidate in
                    guard !candidate.segments.isEmpty, candidate.segments.starts(with: parent), candidate.segments != parent else { return false }
                    return nearestParent(of: candidate.segments) == parent
                }
                .map { PageTreeNode(page: $0.page, children: children(of: $0.segments)) }
        }
        func nearestParent(of segments: [String]) -> [String] {
            var prefix = Array(segments.dropLast())
            while !prefix.isEmpty {
                if paths.contains(where: { $0.segments == prefix }) { return prefix }
                prefix.removeLast()
            }
            return []
        }
        let root = paths.filter { $0.segments.isEmpty }.map { PageTreeNode(page: $0.page, children: []) }
        return root + children(of: [])
    }
}

/// The rows of a page tree, used by the page dropdown and the projects browser.
struct PageTreeRows: View {
    let nodes: [PageTreeNode]
    let current: String?
    var depth = 0
    let onSelect: (PageInfo) -> Void
    var onDelete: ((PageInfo) -> Void)?

    @State private var collapsed: Set<String> = []

    var body: some View {
        ForEach(nodes) { node in
            row(node)
            if !node.children.isEmpty, !collapsed.contains(node.id) {
                PageTreeRows(nodes: node.children, current: current, depth: depth + 1, onSelect: onSelect, onDelete: onDelete)
            }
        }
    }

    private func row(_ node: PageTreeNode) -> some View {
        let isCurrent = node.id == current
        return HStack(spacing: 0) {
            if node.children.isEmpty {
                Color.clear.frame(width: 28, height: Theme.touchTarget)
            } else {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        if collapsed.contains(node.id) { collapsed.remove(node.id) } else { collapsed.insert(node.id) }
                    }
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .rotationEffect(.degrees(collapsed.contains(node.id) ? 0 : 90))
                        .foregroundStyle(Theme.secondaryInk)
                        .frame(width: 28, height: Theme.touchTarget)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel(Text(collapsed.contains(node.id) ? "Expand" : "Collapse"))
            }
            Button {
                onSelect(node.page)
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "doc")
                        .font(.system(size: 14))
                        .foregroundStyle(isCurrent ? Theme.clay : Theme.secondaryInk)
                    Text(node.page.title)
                        .font(Theme.body)
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    if isCurrent {
                        Image(systemName: "checkmark")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.clay)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: Theme.touchTarget, alignment: .leading)
                .contentShape(Rectangle())
            }
            .accessibilityIdentifier("page.row.\(node.id)")
            if let onDelete {
                Button {
                    onDelete(node.page)
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.secondaryInk)
                        .frame(width: Theme.touchTarget, height: Theme.touchTarget)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel(Text("Delete \(node.page.title)"))
                .accessibilityIdentifier("page.delete.\(node.id)")
            }
        }
        .padding(.leading, CGFloat(depth) * 16)
        .padding(.horizontal, 6)
        .background(isCurrent ? Theme.raised : .clear, in: RoundedRectangle(cornerRadius: 10))
    }
}

/// The page switcher: a custom dropdown holding the page tree.
struct PagePicker: View {
    @EnvironmentObject private var model: AppModel
    @State private var open = false
    @State private var naming = false
    @State private var newPageTitle = ""
    @State private var deleting: PageInfo?

    var body: some View {
        Button {
            open.toggle()
        } label: {
            HStack(spacing: 6) {
                Text(model.currentPageTitle)
                    .font(Theme.pageTitle)
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 13, weight: .semibold))
                    .rotationEffect(.degrees(open ? 180 : 0))
                    .animation(.spring(duration: 0.25), value: open)
            }
            .foregroundStyle(Theme.ink)
            .frame(minHeight: Theme.touchTarget)
            .contentShape(Rectangle())
        }
        .accessibilityIdentifier("page.menu")
        .popover(isPresented: $open, arrowEdge: .top) {
            dropdown
                .presentationCompactAdaptation(.popover)
        }
        .alert("New page", isPresented: $naming) {
            TextField("Page name", text: $newPageTitle)
            Button("Cancel", role: .cancel) {}
            Button("Add page") { model.addPage(title: newPageTitle) }
                .accessibilityIdentifier("page.addConfirm")
        }
        .confirmationDialog(
            "Delete this page?",
            isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
            titleVisibility: .visible
        ) {
            Button("Delete page", role: .destructive) {
                if let deleting { model.deletePage(deleting) }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("You can get it back from the version list.")
        }
    }

    private var dropdown: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Pages")
                .font(Theme.caption)
                .foregroundStyle(Theme.secondaryInk)
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 4)
            ScrollView {
                VStack(alignment: .leading, spacing: 2) {
                    PageTreeRows(
                        nodes: PageTreeNode.build(model.pages),
                        current: model.currentPage,
                        onSelect: { page in
                            open = false
                            model.selectPage(page.id)
                        },
                        onDelete: model.pages.count > 1 ? { page in
                            open = false
                            deleting = page
                        } : nil
                    )
                }
                .padding(.horizontal, 8)
            }
            .frame(maxHeight: 360)
            Rectangle().fill(Theme.hairline).frame(height: Theme.hairlineWidth)
            Button {
                open = false
                newPageTitle = ""
                naming = true
            } label: {
                Label("Add a page", systemImage: "plus")
                    .font(Theme.label)
                    .foregroundStyle(Theme.clay)
                    .frame(maxWidth: .infinity, minHeight: Theme.touchTarget, alignment: .leading)
                    .padding(.horizontal, 16)
                    .contentShape(Rectangle())
            }
            .disabled(model.work != nil)
            .accessibilityIdentifier("page.add")
        }
        .frame(width: 300)
        .fixedSize(horizontal: false, vertical: true)
        .background(Theme.surface)
    }
}
