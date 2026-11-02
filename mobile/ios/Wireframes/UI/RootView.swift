import SwiftUI

struct RootView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var versionName = ""

    var body: some View {
        Group {
            if !model.ready {
                Theme.background.ignoresSafeArea()
            } else if sizeClass == .regular {
                TabletScreen()
            } else {
                PhoneScreen()
            }
        }
        .tint(Theme.clay)
        .sheet(isPresented: $model.showingProjects) {
            ProjectsSheet()
        }
        .sheet(isPresented: $model.showingRendering) {
            RenderingSheet()
        }
        .alert("Save this version", isPresented: $model.savingVersion) {
            TextField("Name", text: $versionName)
            Button("Cancel", role: .cancel) {}
            Button("Save") { model.saveVersion(name: versionName) }
        } message: {
            Text("Give it a name so you can find it again.")
        }
        .onChange(of: model.savingVersion) { _, saving in
            if saving { versionName = "" }
        }
        .onChange(of: sizeClass, initial: true) { _, next in
            let tablet = next == .regular
            guard model.isTablet != tablet else { return }
            model.isTablet = tablet
            model.setMode(tablet ? .fill : .phone)
            Task { await model.host.setPointing(model.pagePointing) }
        }
    }
}
