import SwiftUI

@main
struct WireframesApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @StateObject private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .task {
                    delegate.installer = model.installer
                    await model.start()
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.didReceiveMemoryWarningNotification)) { _ in
                    model.didReceiveMemoryWarning()
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .background { model.didEnterBackground() }
                }
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    @MainActor var installer: ModelInstaller?

    func application(_ application: UIApplication, handleEventsForBackgroundURLSession identifier: String, completionHandler: @escaping () -> Void) {
        MainActor.assumeIsolated {
            installer?.backgroundCompletion = completionHandler
        }
    }
}
