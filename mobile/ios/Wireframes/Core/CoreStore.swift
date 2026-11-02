import Foundation
import WfCore

/// Swift's view of the C++ store. Everything is on one queue, so callers can be on any thread.
final class CoreStore: @unchecked Sendable {
    private let handle: OpaquePointer
    private let lock = NSLock()

    init(path: URL) throws {
        var error: UnsafeMutablePointer<CChar>?
        guard let opened = wf_store_open(path.path, &error) else {
            let message = error.map { String(cString: $0) } ?? "The database could not be opened."
            if let error { wf_free(error) }
            throw CoreError(message: message)
        }
        handle = opened
    }

    deinit { wf_store_close(handle) }

    var raw: OpaquePointer { handle }

    func setting(_ key: String) -> String? { locked { CoreJSON.string(wf_store_get_setting(handle, key)) } }

    func setSetting(_ key: String, _ value: String?) {
        locked { _ = wf_store_set_setting(handle, key, value) }
    }

    func projects() -> [ProjectSummary] { locked { CoreJSON.decode(wf_store_projects(handle)) ?? [] } }

    func project(_ id: Int64) -> ProjectState? { locked { CoreJSON.decode(wf_store_project(handle, id)) } }

    func createProject(name: String, wf: String, page: String) -> ProjectState? {
        locked { CoreJSON.decode(wf_store_create_project(handle, name, wf, page, Self.now)) }
    }

    func rename(_ project: Int64, to name: String) { locked { _ = wf_store_rename_project(handle, project, name, Self.now) } }

    func delete(_ project: Int64) { locked { _ = wf_store_delete_project(handle, project) } }

    /// Nil means the project moved on, so this result must not be applied.
    func commit(project: Int64, base: Int64, wf: String, summary: String, page: String) -> ProjectState? {
        locked { CoreJSON.decode(wf_store_commit(handle, project, base, wf, summary, page, Self.now)) }
    }

    func undo(_ project: Int64) -> ProjectState? { locked { CoreJSON.decode(wf_store_undo(handle, project)) } }

    func redo(_ project: Int64) -> ProjectState? { locked { CoreJSON.decode(wf_store_redo(handle, project)) } }

    func versions(_ project: Int64) -> [DesignVersion] { locked { CoreJSON.decode(wf_store_versions(handle, project)) ?? [] } }

    func saveVersion(_ project: Int64, label: String) -> ProjectState? {
        locked { CoreJSON.decode(wf_store_save_version(handle, project, label)) }
    }

    func checkout(_ project: Int64, revision: Int64) -> ProjectState? {
        locked { CoreJSON.decode(wf_store_checkout(handle, project, revision)) }
    }

    func newChat(_ project: Int64) -> ProjectState? { locked { CoreJSON.decode(wf_store_new_chat(handle, project, Self.now)) } }

    func messages(_ chat: Int64) -> [ChatMessage] { locked { CoreJSON.decode(wf_store_messages(handle, chat)) ?? [] } }

    @discardableResult
    func addMessage(chat: Int64, role: String, text: String, revision: Int64 = 0) -> Int64 {
        locked { wf_store_add_message(handle, chat, role, text, revision, Self.now) }
    }

    private func locked<T>(_ body: () -> T) -> T {
        lock.lock()
        defer { lock.unlock() }
        return body()
    }

    private static var now: Int64 { Int64(Date().timeIntervalSince1970) }
}

struct CoreError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

/// Takes ownership of the strings the core returns.
enum CoreJSON {
    static func string(_ value: UnsafeMutablePointer<CChar>?) -> String? {
        guard let value else { return nil }
        defer { wf_free(value) }
        return String(cString: value)
    }

    static func decode<T: Decodable>(_ value: UnsafeMutablePointer<CChar>?) -> T? {
        guard let text = string(value) else { return nil }
        return try? JSONDecoder().decode(T.self, from: Data(text.utf8))
    }
}
