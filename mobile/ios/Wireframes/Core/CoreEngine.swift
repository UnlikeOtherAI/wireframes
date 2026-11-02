import Foundation
import WfCore

/// The model, on its own queue, because loading and generating both block for seconds.
final class CoreEngine: @unchecked Sendable {
    let handle: OpaquePointer = wf_engine_create()
    private let queue = DispatchQueue(label: "wireframes.engine", qos: .userInitiated)

    /// Requests must leave this much of the context for the answer.
    static let contextTokens: Int32 = 8192
    static let maxOutputTokens: Int32 = 1536

    deinit { wf_engine_destroy(handle) }

    var isLoaded: Bool { wf_engine_is_loaded(handle) }

    func cancel() { wf_engine_cancel(handle) }

    func load(path: URL) async -> LoadResult {
        await withCheckedContinuation { continuation in
            queue.async { [handle] in
                #if targetEnvironment(simulator)
                let gpuLayers: Int32 = 0
                #else
                let gpuLayers: Int32 = 99
                #endif
                let params = wf_engine_params(context_tokens: Self.contextTokens, gpu_layers: gpuLayers, threads: 4)
                let result: LoadResult? = CoreJSON.decode(wf_engine_load(handle, path.path, params))
                continuation.resume(returning: result ?? LoadResult(ok: false, gpuLayers: nil, loadMs: nil, error: "The model could not be loaded."))
            }
        }
    }

    func unload() {
        cancel()
        queue.async { [handle] in wf_engine_unload(handle) }
    }

    /// onToken runs on the engine's queue.
    func generate(prompt: String, maxTokens: Int32 = CoreEngine.maxOutputTokens, temperature: Float, onToken: @escaping @Sendable (String) -> Void) async -> GenerationResult {
        await withCheckedContinuation { continuation in
            queue.async { [handle] in
                let box = Unmanaged.passRetained(TokenSink(onToken))
                defer { box.release() }
                let output = wf_engine_generate(handle, prompt, maxTokens, temperature, { piece, context in
                    guard let piece, let context else { return }
                    Unmanaged<TokenSink>.fromOpaque(context).takeUnretainedValue().receive(String(cString: piece))
                }, box.toOpaque())
                let result: GenerationResult? = CoreJSON.decode(output)
                continuation.resume(returning: result ?? GenerationResult(ok: false, text: nil, finish: nil, promptTokens: nil, tokens: nil, firstTokenMs: nil, totalMs: nil, error: "The model did not answer."))
            }
        }
    }
}

private final class TokenSink {
    let receive: (String) -> Void
    init(_ receive: @escaping (String) -> Void) { self.receive = receive }
}
