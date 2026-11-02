import Combine
import SwiftUI

/// The state of the whole app. Views read it and call its methods.
@MainActor
final class AppModel: ObservableObject {
    /// Whether this device can have the model, separately from whether it has it yet.
    enum ModelAvailability: Equatable {
        case checking
        case available(ModelFile)
        case unsupported
        case needsStorage(UInt64)
    }

    enum Work: Equatable {
        case preparing
        case writing
        case checking
    }

    enum LeftPanel {
        case chat
        case projects
    }

    @Published var ready = false
    @Published var availability: ModelAvailability = .checking
    @Published var project: ProjectState?
    @Published var messages: [ChatMessage] = []
    @Published var projects: [ProjectSummary] = []
    @Published var versions: [DesignVersion] = []
    @Published var pages: [PageInfo] = []
    @Published var currentPage = ""
    @Published var selection: Selection?
    @Published var work: Work?
    @Published var failedRequest: String?
    @Published var mode: ViewerMode = .phone
    @Published var designLandscape = false
    @Published var interactive = false
    @Published var showingPreview = false
    @Published var chatHidden = false
    @Published var leftPanel: LeftPanel = .chat
    @Published var showingProjects = false
    @Published var showingRendering = false
    @Published var savingVersion = false
    @Published var snapshot: UIImage?
    @Published var cardSnapshots: [Int64: UIImage] = [:]
    @Published var viewerSize = CGSize(width: 390, height: 844)
    @Published var isTablet = false
    @Published var rendering = RenderingStyle()
    @Published var lastMetrics = ""

    let host = WebHost()
    let engine = CoreEngine()
    let installer = ModelInstaller()
    private(set) var store: CoreStore!
    private var elementSheet = ""
    private var previewArea: CGSize = .zero
    private var generation: Task<Void, Never>?
    private var viewportSent: [String: Int] = [:]
    private var installerWatch: AnyCancellable?
    private var exported: (revision: Int64, name: String, url: URL)?

    private static let arguments = ProcessInfo.processInfo.arguments
    /// The canned model, for walking the controls. Nothing here proves the real one works.
    private var usesCannedModel: Bool { Self.arguments.contains("-wf-ui-test") && !showsModelBanner }
    /// Testing the download banner, so no model is pretended.
    private var showsModelBanner: Bool { Self.arguments.contains("-wf-no-model") }
    /// Any test run, which keeps its own data.
    private var isTestRun: Bool { Self.arguments.contains("-wf-ui-test") || Self.arguments.contains("-wf-real-model") }
    var showsMetrics: Bool { Self.arguments.contains("-wf-real-model") }

    private static let markerKey = "load_in_progress"
    private static let failedKey = "failed_model"
    private static let requestedKey = "model_requested"

    var activeSlot: ViewerSlot {
        if isTablet { return .tablet }
        return showingPreview ? .preview : .card
    }

    var pagePointing: String {
        if isTablet { return "longpress" }
        return showingPreview && !interactive ? "tap" : "none"
    }

    var currentPageTitle: String {
        pages.first { $0.id == currentPage }?.title ?? ""
    }

    var currentVersionNumber: Int64 { versions.first { $0.id == project?.revision }?.number ?? 1 }

    /// Rotating only means something for a device shape.
    var canRotate: Bool { mode == .phone || mode == .tablet }

    var modelReady: Bool { usesCannedModel || installer.phase == .installed }

    // MARK: Start

    func start() async {
        do {
            let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            try FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
            // A test run starts clean and can never touch real projects on the device.
            let database = support.appendingPathComponent(isTestRun ? "uitest.db" : "wireframes.db")
            if isTestRun {
                for suffix in ["", "-wal", "-shm"] {
                    try? FileManager.default.removeItem(atPath: database.path + suffix)
                }
            }
            store = try CoreStore(path: database)
        } catch {
            availability = .unsupported
            ready = true
            return
        }
        installerWatch = installer.objectWillChange.sink { [weak self] _ in self?.objectWillChange.send() }
        bindHost()
        await host.waitUntilReady()
        elementSheet = await host.elementSheet()
        recoverFromInterruptedLoad()
        projects = store.projects()
        await openLastOrNewProject()
        checkModel()
        ready = true
    }

    private func bindHost() {
        host.onSelection = { [weak self] in self?.selection = $0 }
        host.onRendered = { [weak self] page, pages in
            guard let self else { return }
            // A resize re-renders the same page. Republishing would rebuild an open menu.
            if self.currentPage != page { self.currentPage = page }
            if self.pages != pages { self.pages = pages }
            Task { await self.refreshSnapshot() }
        }
        host.onProcessTerminated = { [weak self] in
            guard let self, let project = self.project else { return }
            Task {
                await self.host.waitUntilReady()
                await self.sendViewport(force: true)
                await self.sendRendering()
                _ = await self.host.load(wf: project.wf, page: self.currentPage)
            }
        }
    }

    // MARK: The model

    /// A load that never finished may have been fatal, and a fatal one cannot say so.
    private func recoverFromInterruptedLoad() {
        guard let interrupted = store.setting(Self.markerKey) else { return }
        store.setSetting(Self.failedKey, interrupted)
        store.setSetting(Self.markerKey, nil)
    }

    /// Works out which model belongs on this device. Nothing downloads until it is asked for.
    func checkModel() {
        let attributes = try? URL.applicationSupportDirectory.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
        let freeDisk = UInt64(max(attributes?.volumeAvailableCapacityForImportantUsage ?? 0, 0))
        let ram = Double(ProcessInfo.processInfo.physicalMemory) / 1_073_741_824
        guard let choice = CorePrompt.choose(ram: ram, freeDisk: freeDisk, thermal: 0, e4bQualified: false, failed: store.setting(Self.failedKey)),
              choice.status != "unsupported",
              let file = CorePrompt.catalog().first(where: { $0.id == choice.model }) else {
            availability = .unsupported
            return
        }
        installer.configure(file: file)
        if installer.phase == .installed || installer.hasPartialDownload {
            availability = .available(file)
            if installer.phase != .installed, store.setting(Self.requestedKey) != nil { installer.start() }
            return
        }
        availability = choice.status == "storage" ? .needsStorage(choice.requiredBytes) : .available(file)
        if store.setting(Self.requestedKey) != nil, choice.status != "storage" { installer.start() }
    }

    func downloadModel() {
        store.setSetting(Self.requestedKey, "1")
        installer.start()
    }

    // MARK: Projects

    private func openLastOrNewProject() async {
        if let first = projects.first, let state = store.project(first.id) {
            await show(state)
            return
        }
        if Self.arguments.contains("-wf-ui-test"), let url = Bundle.main.url(forResource: "sample", withExtension: "wf", subdirectory: "dist"),
           let wf = try? String(contentsOf: url), let state = store.createProject(name: "Acme Admin", wf: wf, page: "billing") {
            projects = store.projects()
            await show(state)
            return
        }
        await createProject()
    }

    func createProject() async {
        let name = String(localized: "Untitled")
        guard let wf = await host.newProject(name: name), let state = store.createProject(name: name, wf: wf, page: "home") else { return }
        projects = store.projects()
        await show(state)
    }

    func open(_ summary: ProjectSummary, page: String? = nil) async {
        guard let state = store.project(summary.id) else { return }
        await show(state, page: page)
    }

    func pages(of summary: ProjectSummary) async -> [PageInfo] {
        guard let wf = store.project(summary.id)?.wf else { return [] }
        return await host.pages(of: wf)
    }

    func rename(_ summary: ProjectSummary, to name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        store.rename(summary.id, to: trimmed)
        projects = store.projects()
        if project?.id == summary.id { project = store.project(summary.id) }
    }

    func delete(_ summary: ProjectSummary) async {
        store.delete(summary.id)
        projects = store.projects()
        if project?.id == summary.id {
            project = nil
            await openLastOrNewProject()
            projects = store.projects()
        }
    }

    func newChat() {
        guard let project, let state = store.newChat(project.id) else { return }
        self.project = state
        messages = []
        failedRequest = nil
        Task { await clearSelection() }
    }

    private func show(_ state: ProjectState, page: String? = nil) async {
        project = state
        messages = store.messages(state.chat)
        versions = store.versions(state.id)
        failedRequest = nil
        selection = nil
        cardSnapshots = [:]
        rendering = RenderingStyle(stored: store.setting("rendering.\(state.id)"))
        await sendViewport(force: true)
        await sendRendering()
        await host.setPointing(pagePointing)
        _ = await host.load(wf: state.wf, page: page ?? state.page)
    }

    /// Views ask for this every time they draw, so the file is only written once per revision.
    func exportFile() -> URL? {
        guard let project else { return nil }
        if let exported, exported.revision == project.revision, exported.name == project.name { return exported.url }
        let safe = project.name.replacingOccurrences(of: "/", with: "-")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(safe).wf")
        try? project.wf.write(to: url, atomically: true, encoding: .utf8)
        exported = (project.revision, project.name, url)
        return url
    }

    // MARK: Pages

    /// Adding and removing pages needs no model, so it works before the download.
    func addPage(title: String) {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let id = Self.pageId(trimmed)
        guard !id.isEmpty else { return }
        let quoted = trimmed.replacingOccurrences(of: "\"", with: "\\\"")
        let edit = """
        changes:
          - op: addPage
            id: \(id)
            title: "\(quoted)"
            content:
              - id: \(id)_title
                component: heading
                props:
                  text: "\(quoted)"
                  level: 1
        """
        applyDirect(edit: edit, summary: String(localized: "Added the \(trimmed) page."))
    }

    func deletePage(_ page: PageInfo) {
        applyDirect(edit: "changes:\n  - op: removePage\n    id: \(page.id)", summary: String(localized: "Removed the \(page.title) page."))
    }

    private static func pageId(_ title: String) -> String {
        let slug = title.lowercased().map { $0.isLetter || $0.isNumber ? String($0) : "_" }.joined()
        let parts = slug.split(separator: "_").joined(separator: "_")
        guard let first = parts.first else { return "" }
        return first.isLetter && first.isASCII ? parts : "page_\(parts)"
    }

    private func applyDirect(edit: String, summary: String) {
        guard work == nil, let base = project else { return }
        Task {
            let result = await host.applyEdit(wf: base.wf, output: edit, page: currentPage)
            guard result.ok, let wf = result.wf else {
                store.addMessage(chat: base.chat, role: "assistant", text: String(localized: "I couldn't change the pages. \(result.diagnostics.first?.message ?? "")"))
                messages = store.messages(base.chat)
                return
            }
            await commit(wf: wf, result: result, base: base, page: currentPage, summary: summary)
        }
    }

    // MARK: Viewer

    func viewerLayout(available: CGSize) -> ViewerLayout {
        ViewerLayout(size: viewerSize, scale: ViewerLayout.fitScale(size: viewerSize, available: available))
    }

    /// The area the full page can use. It only decides the page's size in Fill.
    func previewAreaChanged(_ area: CGSize) {
        guard area.width > 0, area.height > 0, area != previewArea else { return }
        previewArea = area
        Task { await sendViewport() }
    }

    func setMode(_ next: ViewerMode) {
        mode = next
        Task { await sendViewport() }
    }

    func rotateDesign() {
        withAnimation(.spring(duration: 0.35)) { designLandscape.toggle() }
        Task { await sendViewport() }
    }

    func setRendering(_ next: RenderingStyle) {
        rendering = next
        if let project { store.setSetting("rendering.\(project.id)", next.stored) }
        Task { await sendRendering() }
    }

    private func sendRendering() async {
        await host.setRendering(corners: rendering.corners.rawValue, mode: rendering.mode.rawValue, adapt: rendering.adapt)
    }

    private func sendViewport(force: Bool = false) async {
        let size = ViewerLayout.devicePreset(mode, landscape: designLandscape) ?? previewArea
        guard size.width > 0, size.height > 0 else { return }
        viewerSize = size
        let key = ["w": Int(size.width), "h": Int(size.height), "m": ViewerMode.allCases.firstIndex(of: mode) ?? 0]
        guard force || key != viewportSent else { return }
        viewportSent = key
        await host.setViewport(ViewerLayout.viewport(mode: mode, landscape: designLandscape, size: size))
    }

    private func refreshSnapshot() async {
        try? await Task.sleep(for: .milliseconds(200))
        guard let image = await host.snapshot() else { return }
        snapshot = image
        if let revision = project?.revision {
            cardSnapshots[revision] = image
            if cardSnapshots.count > 6, let oldest = cardSnapshots.keys.min() { cardSnapshots[oldest] = nil }
        }
    }

    // MARK: Moving between screens

    func showPreview(_ show: Bool) {
        guard !interactive, showingPreview != show else { return }
        // The snapshot from the last render covers the slide. Waiting for a fresh one
        // here could leave the screens stuck if the web view never answers.
        withAnimation(.spring(duration: 0.3)) { showingPreview = show }
        Task { await host.setPointing(pagePointing) }
    }

    func setInteractive(_ on: Bool) {
        interactive = on
        Task {
            if on { await clearSelection() }
            await host.setPointing(pagePointing)
        }
    }

    func setChatHidden(_ hidden: Bool) {
        withAnimation(.spring(duration: 0.3)) { chatHidden = hidden }
    }

    /// On a tablet the projects share the left column with the chat.
    func openProjects() {
        guard isTablet else {
            showingProjects = true
            return
        }
        withAnimation(.spring(duration: 0.3)) {
            leftPanel = .projects
            chatHidden = false
        }
    }

    func closeProjects() {
        showingProjects = false
        withAnimation(.spring(duration: 0.3)) { leftPanel = .chat }
    }

    func selectPage(_ page: String) {
        Task { await host.setPage(page) }
    }

    func clearSelection() async {
        selection = nil
        await host.clearSelection()
    }

    // MARK: History

    func undo() { apply(project.flatMap { store.undo($0.id) }) }
    func redo() { apply(project.flatMap { store.redo($0.id) }) }
    func restore(_ version: DesignVersion) { apply(project.flatMap { store.checkout($0.id, revision: version.id) }) }

    func saveVersion(name: String) {
        guard let project else { return }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let label = trimmed.isEmpty ? String(localized: "Version \(currentVersionNumber)") : trimmed
        guard let state = store.saveVersion(project.id, label: label) else { return }
        self.project = state
        versions = store.versions(state.id)
    }

    private func apply(_ state: ProjectState?) {
        guard work == nil, let state else { return }
        project = state
        versions = store.versions(state.id)
        Task { _ = await host.load(wf: state.wf, page: currentPage) }
    }

    // MARK: Generating

    func send(_ text: String) {
        let request = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !request.isEmpty, work == nil, modelReady, let project else { return }
        let messageId = store.addMessage(chat: project.chat, role: "user", text: request)
        messages = store.messages(project.chat)
        failedRequest = nil
        work = .preparing
        generation = Task { await self.generate(request: request, messageId: messageId, base: project) }
    }

    func retry() {
        guard let request = failedRequest else { return }
        send(request)
    }

    func stop() {
        engine.cancel()
    }

    private func generate(request: String, messageId: Int64, base: ProjectState) async {
        defer {
            work = nil
            generation = nil
        }
        if ProcessInfo.processInfo.thermalState == .critical {
            fail(request, String(localized: "This device is too warm right now. Let it cool, then try again."), chat: base.chat)
            return
        }
        if !usesCannedModel, !(await ensureModelLoaded()) {
            fail(request, String(localized: "The model could not start on this device. Your design is unchanged."), chat: base.chat)
            return
        }

        let page = currentPage
        guard let context = await host.context(wf: base.wf, page: page, source: selection?.source) else {
            fail(request, String(localized: "I couldn't read this project. Your design is unchanged."), chat: base.chat)
            return
        }
        var fields = PromptFields(elements: elementSheet, context: context, request: request, beforeMessage: messageId, chat: base.chat, project: base.id)

        // One chance to repair a rejected answer, then the design stays as it was.
        for attempt in 0..<2 {
            work = .writing
            guard let output = await modelOutput(fields: fields, attempt: attempt) else {
                fail(request, String(localized: "Stopped. Your design is unchanged."), chat: base.chat)
                return
            }
            work = .checking
            let result = await host.applyEdit(wf: base.wf, output: output, page: page)
            if result.ok, let wf = result.wf {
                await commit(wf: wf, result: result, base: base, page: page, summary: Self.receipt(result.changes ?? []))
                return
            }
            fields.failedOutput = output
            fields.diagnostics = result.diagnostics.map { "\($0.code): \($0.message)" }.joined(separator: "\n")
        }
        fail(request, String(localized: "I couldn't apply that change. Your design is unchanged. Try a smaller change."), chat: base.chat)
    }

    private func modelOutput(fields: PromptFields, attempt: Int) async -> String? {
        #if DEBUG
        if usesCannedModel { return await UITestModel.answer(for: fields.request) }
        #endif
        let built = CorePrompt.build(store: store, engine: engine, fields: fields)
        guard let prompt = built.prompt else { return nil }
        let result = await engine.generate(prompt: prompt, temperature: attempt == 0 ? 0.3 : 0.1) { _ in }
        if showsMetrics {
            lastMetrics = "prompt=\(result.promptTokens ?? 0) out=\(result.tokens ?? 0) first=\(result.firstTokenMs ?? 0)ms total=\(result.totalMs ?? 0)ms attempt=\(attempt) finish=\(result.finish ?? result.error ?? "")"
        }
        guard result.ok, result.finish != "cancelled", let text = result.text else { return nil }
        return "changes:\n" + text
    }

    private func commit(wf: String, result: EditResult, base: ProjectState, page: String, summary: String) async {
        let target = result.page ?? page
        // The page must draw before the revision is recorded, so what is saved is what renders.
        guard await host.load(wf: wf, page: target) else {
            _ = await host.load(wf: base.wf, page: page)
            fail(store.messages(base.chat).last { $0.isUser }?.text ?? "", String(localized: "I couldn't apply that change. Your design is unchanged. Try a smaller change."), chat: base.chat)
            return
        }
        guard let state = store.commit(project: base.id, base: base.revision, wf: wf, summary: summary, page: target) else {
            _ = await host.load(wf: project?.wf ?? base.wf, page: page)
            return
        }
        store.addMessage(chat: base.chat, role: "assistant", text: summary, revision: state.revision)
        project = state
        messages = store.messages(state.chat)
        versions = store.versions(state.id)
        projects = store.projects()
        await clearSelection()
    }

    private static func receipt(_ changes: [String]) -> String {
        guard let first = changes.first else { return String(localized: "Updated the design.") }
        if changes.count == 1 { return first + "." }
        return String(localized: "\(first) and \(changes.count - 1) more.")
    }

    private func fail(_ request: String, _ message: String, chat: Int64) {
        failedRequest = request
        store.addMessage(chat: chat, role: "assistant", text: message)
        messages = store.messages(chat)
    }

    private func ensureModelLoaded() async -> Bool {
        if engine.isLoaded { return true }
        guard let url = installer.modelURL, let file = installer.file else { return false }
        store.setSetting(Self.markerKey, file.id)
        let loaded = await engine.load(path: url)
        if showsMetrics { lastMetrics = "load ok=\(loaded.ok) gpu=\(loaded.gpuLayers ?? -1) \(loaded.loadMs ?? 0)ms \(loaded.error ?? "")" }
        guard loaded.ok else {
            store.setSetting(Self.markerKey, nil)
            return false
        }
        // Only a real token proves the model works, so the marker stays until one arrives.
        let probe = await engine.generate(prompt: "<|turn>user\nHi<turn|>\n<|turn>model\n", maxTokens: 2, temperature: 0.1) { _ in }
        store.setSetting(Self.markerKey, nil)
        return probe.ok
    }

    func didReceiveMemoryWarning() {
        if work == nil { engine.unload() }
    }

    func didEnterBackground() {
        if work == nil { engine.unload() }
    }
}

/// How one project's pages are drawn, per project and never written into its files.
struct RenderingStyle: Equatable {
    enum Corners: String, CaseIterable { case rounded, square }
    enum Mode: String, CaseIterable { case card, line }

    var corners: Corners = .rounded
    var mode: Mode = .card
    /// Rearrange a page shown smaller than it was designed for.
    var adapt = true

    init() {}

    init(stored: String?) {
        let parts = (stored ?? "").split(separator: ",").map(String.init)
        if parts.count >= 2 {
            corners = Corners(rawValue: parts[0]) ?? .rounded
            mode = Mode(rawValue: parts[1]) ?? .card
        }
        if parts.count >= 3 { adapt = parts[2] != "fixed" }
    }

    var stored: String { "\(corners.rawValue),\(mode.rawValue),\(adapt ? "adapt" : "fixed")" }
}
