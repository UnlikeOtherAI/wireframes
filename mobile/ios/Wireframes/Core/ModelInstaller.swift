import Foundation
import WfCore

/// Fetches the chosen model once and installs it only after its digest checks out.
/// The download is a background session, so it carries on when the app is not in front.
@MainActor
final class ModelInstaller: NSObject, ObservableObject {
    enum Phase: Equatable {
        case idle
        case downloading(done: UInt64, total: UInt64)
        case paused(done: UInt64, total: UInt64)
        case waitingForWiFi(total: UInt64)
        case checking(done: UInt64, total: UInt64)
        case installed
        case failed
    }

    @Published private(set) var phase: Phase = .idle
    private(set) var file: ModelFile?

    private var session: URLSession?
    private var task: URLSessionDownloadTask?
    private var urlIndex = 0
    private var allowCellular = false
    var backgroundCompletion: (() -> Void)?

    static let sessionIdentifier = "com.unlikeotherai.wireframes.model"

    private static var directory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("models", isDirectory: true)
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var url = base
        try? url.setResourceValues(values)
        return base
    }

    private func installedURL(_ file: ModelFile) -> URL { Self.directory.appendingPathComponent(file.fileName) }
    private func stagedURL(_ file: ModelFile) -> URL { Self.directory.appendingPathComponent(file.fileName + ".staged") }
    private func resumeURL(_ file: ModelFile) -> URL { Self.directory.appendingPathComponent(file.fileName + ".resume") }

    var modelURL: URL? {
        guard let file, FileManager.default.fileExists(atPath: installedURL(file).path) else { return nil }
        return installedURL(file)
    }

    /// Says which file belongs on this device, without fetching anything.
    func configure(file: ModelFile) {
        self.file = file
        if FileManager.default.fileExists(atPath: installedURL(file).path) { phase = .installed }
    }

    var hasPartialDownload: Bool {
        guard let file else { return false }
        return FileManager.default.fileExists(atPath: stagedURL(file).path) || FileManager.default.fileExists(atPath: resumeURL(file).path)
    }

    /// Picks up wherever the last run got to, including a transfer iOS kept going.
    func start() {
        guard let file else { return }
        if FileManager.default.fileExists(atPath: installedURL(file).path) {
            phase = .installed
            return
        }
        if FileManager.default.fileExists(atPath: stagedURL(file).path) {
            verifyStaged()
            return
        }
        beginTransfer()
    }

    private func makeSession() -> URLSession {
        if let session, session.configuration.allowsCellularAccess == allowCellular { return session }
        session?.finishTasksAndInvalidate()
        let configuration = URLSessionConfiguration.background(withIdentifier: Self.sessionIdentifier)
        configuration.isDiscretionary = false
        configuration.sessionSendsLaunchEvents = true
        configuration.allowsCellularAccess = allowCellular
        configuration.waitsForConnectivity = true
        configuration.timeoutIntervalForResource = 7 * 24 * 60 * 60
        let created = URLSession(configuration: configuration, delegate: self, delegateQueue: .main)
        session = created
        return created
    }

    private func beginTransfer() {
        guard let file else { return }
        let session = makeSession()
        session.getAllTasks { [weak self] tasks in
            Task { @MainActor [weak self] in
                guard let self else { return }
                if let running = tasks.compactMap({ $0 as? URLSessionDownloadTask }).first(where: { $0.state == .running || $0.state == .suspended }) {
                    self.task = running
                    running.resume()
                    self.phase = .downloading(done: UInt64(max(running.countOfBytesReceived, 0)), total: file.bytes)
                    return
                }
                self.launchTask(file: file)
            }
        }
    }

    private func launchTask(file: ModelFile) {
        let session = makeSession()
        let created: URLSessionDownloadTask
        if let resume = try? Data(contentsOf: resumeURL(file)) {
            created = session.downloadTask(withResumeData: resume)
            try? FileManager.default.removeItem(at: resumeURL(file))
        } else {
            guard urlIndex < file.urls.count, let url = URL(string: file.urls[urlIndex]) else {
                phase = .failed
                return
            }
            created = session.downloadTask(with: url)
        }
        created.countOfBytesClientExpectsToReceive = Int64(file.bytes)
        task = created
        created.resume()
        phase = .downloading(done: 0, total: file.bytes)
    }

    func pause() {
        guard case .downloading(let done, let total) = phase, let file else { return }
        phase = .paused(done: done, total: total)
        task?.cancel(byProducingResumeData: { data in
            Task { @MainActor in
                if let data { try? data.write(to: self.resumeURL(file)) }
            }
        })
        task = nil
    }

    func resume() {
        urlIndex = min(urlIndex, (file?.urls.count ?? 1) - 1)
        beginTransfer()
    }

    func useCellular() {
        allowCellular = true
        beginTransfer()
    }

    func retry() {
        urlIndex = 0
        start()
    }

    private func verifyStaged() {
        guard let file else { return }
        phase = .checking(done: 0, total: file.bytes)
        let staged = stagedURL(file)
        let installed = installedURL(file)
        let expected = file.sha256
        let total = file.bytes
        Task.detached(priority: .utility) { [weak self] in
            let sink = HashProgress { done in
                Task { @MainActor [weak self] in self?.phase = .checking(done: done, total: total) }
            }
            let box = Unmanaged.passRetained(sink)
            defer { box.release() }
            let digest = CoreJSON.string(wf_sha256_file(staged.path, { done, _, context in
                guard let context else { return false }
                Unmanaged<HashProgress>.fromOpaque(context).takeUnretainedValue().report(done)
                return true
            }, box.toOpaque()))
            let matches = digest == expected
            if matches {
                try? FileManager.default.moveItem(at: staged, to: installed)
            } else {
                try? FileManager.default.removeItem(at: staged)
            }
            await MainActor.run { [weak self] in
                guard let self else { return }
                if matches {
                    self.phase = .installed
                } else {
                    self.nextSourceOrFail()
                }
            }
        }
    }

    private func nextSourceOrFail() {
        guard let file else { return }
        urlIndex += 1
        if urlIndex < file.urls.count {
            launchTask(file: file)
        } else {
            phase = .failed
        }
    }
}

private final class HashProgress: @unchecked Sendable {
    private let onReport: (UInt64) -> Void
    private var last: UInt64 = 0
    init(_ onReport: @escaping (UInt64) -> Void) { self.onReport = onReport }

    func report(_ done: UInt64) {
        guard done - last >= 64 << 20 else { return }
        last = done
        onReport(done)
    }
}

extension ModelInstaller: URLSessionDownloadDelegate {
    nonisolated func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        let done = UInt64(max(totalBytesWritten, 0))
        MainActor.assumeIsolated {
            guard let file, self.task === downloadTask || self.task == nil else { return }
            self.task = downloadTask
            self.phase = .downloading(done: done, total: file.bytes)
        }
    }

    nonisolated func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        // iOS deletes this file when the delegate returns, so it moves to staging now.
        let status = (downloadTask.response as? HTTPURLResponse)?.statusCode ?? 0
        let fileName = MainActor.assumeIsolated { self.file?.fileName }
        guard (200..<300).contains(status), let fileName else { return }
        let staged = Self.stagingPath(fileName)
        try? FileManager.default.removeItem(at: staged)
        try? FileManager.default.moveItem(at: location, to: staged)
    }

    nonisolated private static func stagingPath(_ fileName: String) -> URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("models", isDirectory: true)
            .appendingPathComponent(fileName + ".staged")
    }

    nonisolated func urlSession(_ session: URLSession, task finished: URLSessionTask, didCompleteWithError error: Error?) {
        let resume = (error as NSError?)?.userInfo[NSURLSessionDownloadTaskResumeData] as? Data
        let status = (finished.response as? HTTPURLResponse)?.statusCode ?? 0
        let cancelled = (error as NSError?)?.code == NSURLErrorCancelled
        MainActor.assumeIsolated {
            guard let file else { return }
            if case .paused = phase { return }
            task = nil
            if cancelled { return }
            if let resume { try? resume.write(to: resumeURL(file)) }
            if error == nil, (200..<300).contains(status), FileManager.default.fileExists(atPath: stagedURL(file).path) {
                verifyStaged()
            } else if resume != nil {
                beginTransfer()
            } else {
                nextSourceOrFail()
            }
        }
    }

    nonisolated func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        MainActor.assumeIsolated {
            backgroundCompletion?()
            backgroundCompletion = nil
        }
    }
}
