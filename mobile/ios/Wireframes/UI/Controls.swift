import SwiftUI

struct Card<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) { content }
            .padding(Theme.spacing)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.radius))
            .overlay(RoundedRectangle(cornerRadius: Theme.radius).stroke(Theme.hairline, lineWidth: Theme.hairlineWidth))
            .shadow(color: .black.opacity(0.04), radius: 8, y: 2)
    }
}

struct PrimaryButton: View {
    let title: LocalizedStringKey
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(Theme.label)
                .frame(maxWidth: .infinity, minHeight: Theme.touchTarget)
                .foregroundStyle(Theme.onClay)
                .background(Theme.clay, in: RoundedRectangle(cornerRadius: Theme.controlRadius))
        }
    }
}

struct SecondaryButton: View {
    let title: LocalizedStringKey
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(Theme.label)
                .frame(maxWidth: .infinity, minHeight: Theme.touchTarget)
                .foregroundStyle(Theme.ink)
                .overlay(RoundedRectangle(cornerRadius: Theme.controlRadius).stroke(Theme.hairline, lineWidth: Theme.hairlineWidth))
        }
    }
}

struct IconButton: View {
    let systemName: String
    let label: LocalizedStringKey
    var enabled = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 19, weight: .regular))
                .frame(width: Theme.touchTarget, height: Theme.touchTarget)
                .contentShape(Rectangle())
                .foregroundStyle(enabled ? Theme.ink : Theme.secondaryInk.opacity(0.5))
        }
        .disabled(!enabled)
        .accessibilityLabel(Text(label))
    }
}

/// A row of equal choices with one selected.
struct Segments<Value: Hashable>: View {
    let options: [Value]
    let selected: Value
    let title: (Value) -> LocalizedStringKey
    let identifier: (Value) -> String
    let onSelect: (Value) -> Void

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options, id: \.self) { option in
                Button { onSelect(option) } label: {
                    Text(title(option))
                        .font(Theme.label)
                        .lineLimit(1)
                        .fixedSize()
                        .padding(.horizontal, 12)
                        .frame(minHeight: 36)
                        .foregroundStyle(option == selected ? Theme.onClay : Theme.ink)
                        .background(option == selected ? Theme.clay : .clear, in: Capsule())
                        .frame(minHeight: Theme.touchTarget)
                        .contentShape(Rectangle())
                }
                .accessibilityIdentifier(identifier(option))
                .accessibilityAddTraits(option == selected ? .isSelected : [])
            }
        }
        .padding(.horizontal, 3)
        .background(Theme.raised, in: Capsule().inset(by: 3))
    }
}

/// The message field, with whatever component is attached to it.
struct Composer: View {
    @EnvironmentObject private var model: AppModel
    let placeholder: LocalizedStringKey
    @State private var text = ""
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let selection = model.selection {
                HStack(spacing: 6) {
                    Text(selection.shared ? "\(selection.label), used in several places" : "\(selection.label)")
                        .font(Theme.caption)
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    Button {
                        Task { await model.clearSelection() }
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.secondaryInk)
                            .frame(width: 32, height: Theme.touchTarget)
                            .contentShape(Rectangle())
                    }
                    .accessibilityLabel(Text("Clear selection"))
                    .accessibilityIdentifier("composer.clearSelection")
                }
                .padding(.leading, 12)
                .background(Theme.raised, in: Capsule())
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("composer.selection")
            }
            HStack(alignment: .bottom, spacing: 8) {
                TextField(model.modelReady ? placeholder : "Download the offline model first", text: $text, axis: .vertical)
                    .lineLimit(1...5)
                    .focused($focused)
                    .disabled(!model.modelReady)
                    .font(Theme.body)
                    .foregroundStyle(Theme.ink)
                    .padding(.vertical, 12)
                    .accessibilityIdentifier("composer.field")
                Button {
                    let sent = text
                    text = ""
                    focused = false
                    model.send(sent)
                } label: {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Theme.onClay)
                        .frame(width: 36, height: 36)
                        .background(canSend ? Theme.clay : Theme.clay.opacity(0.4), in: Circle())
                        .frame(width: Theme.touchTarget, height: Theme.touchTarget)
                        .contentShape(Rectangle())
                }
                .disabled(!canSend)
                .accessibilityLabel(Text("Send"))
                .accessibilityIdentifier("composer.send")
            }
            .padding(.leading, 16)
            .padding(.trailing, 4)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 24))
            .overlay(RoundedRectangle(cornerRadius: 24).stroke(Theme.hairline, lineWidth: Theme.hairlineWidth))
        }
    }

    private var canSend: Bool {
        model.modelReady && model.work == nil && !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

/// What the model is doing, with the way to stop it.
struct WorkStatus: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        if let work = model.work {
            HStack(spacing: 10) {
                ProgressView().tint(Theme.secondaryInk)
                Text(message(work))
                    .font(Theme.body)
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                Spacer(minLength: 8)
                Button("Stop") { model.stop() }
                    .font(Theme.label)
                    .foregroundStyle(Theme.ink)
                    .padding(.horizontal, 14)
                    .frame(minHeight: 36)
                    .overlay(Capsule().stroke(Theme.hairline, lineWidth: Theme.hairlineWidth))
                    .frame(minHeight: Theme.touchTarget)
                    .contentShape(Rectangle())
                    .accessibilityIdentifier("work.stop")
            }
            .padding(.horizontal, 12)
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("work.status")
        }
    }

    private func message(_ work: AppModel.Work) -> LocalizedStringKey {
        switch work {
        case .preparing: return "Preparing on this device..."
        case .writing: return "Updating \(model.currentPageTitle)..."
        case .checking: return "Checking \(model.currentPageTitle)..."
        }
    }
}

/// Turns the page sideways. The icon shows the orientation a tap will switch to, and
/// turns as it changes. Only a device shape has an orientation, so otherwise it is gone.
struct RotateButton: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        if model.canRotate {
            Button { model.rotateDesign() } label: {
                Image(systemName: model.mode == .phone ? "iphone" : "ipad")
                    .font(.system(size: 21))
                    .foregroundStyle(Theme.ink)
                    .rotationEffect(.degrees(model.designLandscape ? 0 : 90))
                    .frame(width: Theme.touchTarget, height: Theme.touchTarget)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel(Text(model.designLandscape ? "Switch to portrait" : "Switch to landscape"))
            .accessibilityIdentifier("viewer.rotate")
            .transition(.opacity.combined(with: .scale))
        }
    }
}

/// Keeps the current design as a named version.
struct SaveVersionButton: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        let saved = model.project?.saved == true
        Button {
            model.savingVersion = true
        } label: {
            Image(systemName: saved ? "bookmark.fill" : "bookmark")
                .font(.system(size: 18))
                .foregroundStyle(saved ? Theme.clay : Theme.ink)
                .frame(width: Theme.touchTarget, height: Theme.touchTarget)
                .contentShape(Rectangle())
        }
        .disabled(saved || model.work != nil)
        .accessibilityLabel(Text(saved ? "Version saved" : "Save version"))
        .accessibilityIdentifier("version.save")
    }
}

struct VersionMenu: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        Menu {
            ForEach(model.versions) { version in
                Button {
                    model.restore(version)
                } label: {
                    if version.label.isEmpty {
                        Text(version.summary.isEmpty ? "Version \(version.number)" : "\(version.number). \(version.summary)")
                    } else {
                        Label(version.label, systemImage: "bookmark.fill")
                    }
                }
            }
        } label: {
            HStack(spacing: 6) {
                Text("Version \(model.currentVersionNumber)")
                    .font(Theme.label)
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 11, weight: .semibold))
            }
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 12)
            .frame(minHeight: 36)
            .overlay(Capsule().stroke(Theme.hairline, lineWidth: Theme.hairlineWidth))
            .frame(minHeight: Theme.touchTarget)
            .contentShape(Rectangle())
        }
        .accessibilityIdentifier("version.menu")
    }
}

struct OverflowMenu: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        Menu {
            Button { model.undo() } label: { Label("Undo", systemImage: "arrow.uturn.backward") }
                .disabled(model.project?.canUndo != true || model.work != nil)
                .accessibilityIdentifier("overflow.undo")
            Button { model.redo() } label: { Label("Redo", systemImage: "arrow.uturn.forward") }
                .disabled(model.project?.canRedo != true || model.work != nil)
                .accessibilityIdentifier("overflow.redo")
            Button { model.savingVersion = true } label: { Label("Save version", systemImage: "square.and.arrow.down") }
                .disabled(model.project?.saved == true || model.work != nil)
            Button { model.showingRendering = true } label: { Label("Page style", systemImage: "square.on.square") }
            if let url = model.exportFile() {
                ShareLink(item: url) { Label("Export project", systemImage: "square.and.arrow.up") }
                    .accessibilityIdentifier("overflow.export")
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: 19))
                .foregroundStyle(Theme.ink)
                .frame(width: Theme.touchTarget, height: Theme.touchTarget)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(Text("More"))
        .accessibilityIdentifier("overflow.menu")
    }
}
